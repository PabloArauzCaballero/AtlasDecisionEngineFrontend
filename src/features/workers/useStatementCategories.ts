'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { asRecord, asRows, asStrings } from '../../utils/records';
import { isTerminal, type WorkerRun } from './worker-types';
import { createSemanticRun, fetchRun } from './workers.api';

/**
 * Clasifica los movimientos de un extracto, uno por uno, contra el semántico.
 *
 * **Esto es orquestación de cliente, y conviene saber por qué.** El motor no
 * publica ninguna ruta «extracto → categorías»: el de extractos devuelve
 * movimientos sin categoría y el semántico clasifica UN texto por ejecución. La
 * forma que el motor documenta para componer dos workers es un grafo con un
 * nodo `WORKER` (`EXTRACTO_CAPACIDAD_PAGO` lo demuestra), no un bucle en una
 * pantalla. Mientras esa pieza no exista, esto encadena aquí lo que allí no está
 * encadenado — y por eso se comporta con el cuidado que un bucle sobre una API
 * ajena exige: deduplica, limita la concurrencia, se puede parar y dice cuánto
 * dejó fuera.
 *
 * Tres decisiones que sostienen ese cuidado:
 *
 * - **Deduplica por glosa.** Un extracto repite «COMISION MANTENIMIENTO» doce
 *   veces; clasificarla doce veces son once ejecuciones que dicen lo mismo. El
 *   motor además deriva su clave de idempotencia del contenido, así que el
 *   reenvío tampoco crearía ejecuciones nuevas: deduplicar aquí ahorra las
 *   peticiones, no sólo el trabajo.
 * - **Cuatro en vuelo como mucho.** El motor corta en 300 peticiones por minuto
 *   (`RATE_LIMIT_MANAGEMENT_REQUESTS`) y cada movimiento cuesta un alta más los
 *   sondeos hasta que termina. Sin tope, un extracto largo se come el limitador
 *   y las respuestas empiezan a llegar 429 — que la vista leería como fallos de
 *   clasificación cuando en realidad es el portal atacándose a sí mismo.
 * - **No trunca en silencio.** Por encima de `MAX_GLOSAS` no clasifica y lo
 *   dice. Un tope callado dejaría media tabla con categoría y media sin, que se
 *   lee como «esos movimientos no encajan en ninguna» en vez de «no se
 *   preguntó».
 */

/** Ejecuciones simultáneas contra el semántico. */
const EN_VUELO = 4;
/** Cada cuánto se pregunta por una ejecución en curso. El mismo ritmo que `useWorkerRun`. */
const SONDEO_MS = 1_500;
/**
 * Glosas distintas que se aceptan de una vez.
 *
 * Ciento veinte glosas distintas son unas quinientas peticiones contando
 * sondeos: cabe holgado en el minuto del limitador repartido de cuatro en
 * cuatro. Por encima, lo honesto es no empezar.
 */
const MAX_GLOSAS = 120;

export interface VeredictoCategoria {
  fase: 'esperando' | 'en-curso' | 'listo' | 'fallido';
  /** Veredicto del semántico: `MATCH`, `AMBIGUOUS`, `UNKNOWN`… */
  estado?: string;
  categoria?: string;
  /** Ruta legible de la categoría, de la raíz a la hoja. */
  ruta?: readonly string[];
  confianza?: number;
  error?: string;
}

interface Estado {
  veredictos: Record<string, VeredictoCategoria>;
  corriendo: boolean;
  hechas: number;
  total: number;
  /** Glosas distintas que había cuando se rechazó empezar, o `null` si cabían. */
  demasiadas: number | null;
}

const VACIO: Estado = {
  veredictos: {},
  corriendo: false,
  hechas: 0,
  total: 0,
  demasiadas: null,
};

/** Normaliza la glosa para agrupar: espacios de más y mayúsculas no cambian la categoría. */
export function claveGlosa(descripcion: string): string {
  return descripcion.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-BO');
}

export function useStatementCategories() {
  const [estado, setEstado] = useState<Estado>(VACIO);
  /*
   * El corte va en una `ref` y no en el estado: lo consultan los bucles que ya
   * están en vuelo, y un valor de estado quedaría congelado en la clausura con
   * la que arrancaron. Leerlo de la `ref` ve el corte en cuanto ocurre.
   */
  const cortado = useRef(false);

  // Al desmontar la vista se corta: seguir clasificando para una tabla que ya no
  // está en pantalla sólo gasta el limitador del motor.
  useEffect(() => () => void (cortado.current = true), []);

  const parar = useCallback(() => {
    cortado.current = true;
    setEstado((previo) => ({ ...previo, corriendo: false }));
  }, []);

  const limpiar = useCallback(() => {
    cortado.current = true;
    setEstado(VACIO);
  }, []);

  const clasificar = useCallback(async (descripciones: readonly string[]) => {
    const glosas = [...new Set(descripciones.map(claveGlosa).filter((texto) => texto !== ''))];

    if (glosas.length > MAX_GLOSAS) {
      setEstado({ ...VACIO, demasiadas: glosas.length });
      return;
    }
    if (glosas.length === 0) return;

    cortado.current = false;
    setEstado({
      veredictos: Object.fromEntries(
        glosas.map((glosa) => [glosa, { fase: 'esperando' as const }]),
      ),
      corriendo: true,
      hechas: 0,
      total: glosas.length,
      demasiadas: null,
    });

    const anotar = (glosa: string, veredicto: VeredictoCategoria) =>
      setEstado((previo) => ({
        ...previo,
        veredictos: { ...previo.veredictos, [glosa]: veredicto },
        hechas:
          previo.hechas + (veredicto.fase === 'esperando' || veredicto.fase === 'en-curso' ? 0 : 1),
      }));

    // Un turno por hueco: cada uno toma la siguiente glosa libre hasta agotarlas.
    let siguiente = 0;
    const turno = async () => {
      while (!cortado.current) {
        const indice = siguiente++;
        if (indice >= glosas.length) return;
        const glosa = glosas[indice] as string;
        anotar(glosa, { fase: 'en-curso' });
        anotar(glosa, await clasificarUna(glosa, () => cortado.current));
      }
    };

    await Promise.all(Array.from({ length: Math.min(EN_VUELO, glosas.length) }, turno));
    setEstado((previo) => ({ ...previo, corriendo: false }));
  }, []);

  return { ...estado, clasificar, parar, limpiar, maxGlosas: MAX_GLOSAS };
}

/** Encola una glosa y la sigue hasta que el motor la da por terminada. */
async function clasificarUna(
  glosa: string,
  hayQueParar: () => boolean,
): Promise<VeredictoCategoria> {
  try {
    const creada = await createSemanticRun({ text: glosa });
    let ejecucion: WorkerRun = creada;

    while (!isTerminal(ejecucion.status)) {
      if (hayQueParar()) return { fase: 'fallido', error: 'Cancelado' };
      await new Promise((listo) => setTimeout(listo, SONDEO_MS));
      if (hayQueParar()) return { fase: 'fallido', error: 'Cancelado' };
      ejecucion = await fetchRun('semantic-analysis', ejecucion.requestId);
    }

    if (ejecucion.status === 'FAILED' || ejecucion.status === 'CANCELLED') {
      return {
        fase: 'fallido',
        error: ejecucion.errorMessage ?? ejecucion.errorCode ?? 'La ejecución no terminó bien.',
      };
    }
    return leerVeredicto(ejecucion.result);
  } catch (error) {
    return { fase: 'fallido', error: error instanceof Error ? error.message : 'Error inesperado' };
  }
}

/**
 * Saca del resultado la categoría que gana.
 *
 * Lectura defensiva, como el resto de vistas de worker: el JSON lo escribió el
 * motor y puede venir de una versión anterior. Y se toma la PRIMERA coincidencia
 * porque el motor las devuelve ordenadas por pertinencia; cuando su veredicto es
 * `AMBIGUOUS` o `UNKNOWN` eso se conserva tal cual, sin ascender la primera a
 * ganadora: una categoría dudosa presentada como firme es peor que un hueco.
 */
function leerVeredicto(resultado: unknown): VeredictoCategoria {
  const datos = asRecord(resultado);
  const rutas = asRecord(datos.categoryPaths);
  const primera = asRecord(asRows(datos.matches)[0]);
  const codigo = primera.categoryCode === undefined ? undefined : String(primera.categoryCode);

  return {
    fase: 'listo',
    estado: String(datos.status ?? 'UNKNOWN'),
    categoria: codigo,
    ruta: codigo ? asStrings(rutas[codigo]) : undefined,
    confianza: typeof primera.confidence === 'number' ? primera.confidence : undefined,
  };
}
