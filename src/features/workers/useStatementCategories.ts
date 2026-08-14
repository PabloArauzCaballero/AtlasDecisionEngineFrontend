'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PORTAL_LOCALE } from '../../config/locale';
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
 * - **Clasificar PREGUNTA; no lee lo que se preguntó otro día.** La
 *   deduplicación del motor es por contenido y no caduca, así que una glosa
 *   analizada antes devolvía su veredicto de entonces, calculado contra el
 *   catálogo de categorías de entonces. Con un catálogo que crece eso es una
 *   trampa: la tabla enseñaba «Sin determinar» en movimientos cuya categoría YA
 *   existía —«PAGO QR COMERCIO», con su hoja sembrada— y el botón no podía
 *   arreglarlo por más que se pulsara, porque cada pulsación devolvía la misma
 *   respuesta guardada. Por eso cada tanda manda su propia clave de
 *   idempotencia, que es la vía que el motor documenta para forzar el
 *   reanálisis. La deduplicación que sí interesa —la glosa repetida doce veces
 *   dentro del mismo extracto— ya la hace la línea de arriba, y ésa se conserva.
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
/**
 * Longitud que se conserva de la glosa dentro de la clave de la tanda.
 *
 * El motor acepta 200 caracteres; el prefijo con la marca se lleva unos veinte y
 * el resto es margen. La glosa va dentro sólo para que la clave se pueda leer en
 * la tabla de ejecuciones: quien la hace nueva es la marca.
 */
const MAX_GLOSA_EN_CLAVE = 150;

/**
 * Clave de idempotencia de una tanda de clasificación.
 *
 * La marca es común a toda la tanda, y ese alcance es la decisión: dentro de una
 * tanda sigue habiendo deduplicación —un reenvío accidental de la misma glosa no
 * crea una segunda ejecución ni gasta cuota dos veces, que es lo que el motor
 * protege—, y entre tandas no la hay, que es lo que evita servir el veredicto de
 * un catálogo que ya no existe.
 */
function claveDeTanda(glosa: string, marca: string): string {
  return `extracto:${marca}:${glosa.slice(0, MAX_GLOSA_EN_CLAVE)}`;
}

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
  return descripcion.trim().replace(/\s+/g, ' ').toLocaleUpperCase(PORTAL_LOCALE);
}

/** Un movimiento del extracto, con lo único que hace falta para clasificarlo. */
export interface MovimientoAClasificar {
  descripcion: string;
  /** `CREDIT` o `DEBIT`, tal como los devuelve el worker de extractos. */
  movementType: string;
}

/**
 * La clave agrupa por glosa **y por sentido**, y esa segunda mitad corrige un
 * defecto real.
 *
 * `TRASPASO ENTRE CAJAS DE AHORRO (MOVIL)` aparece en el mismo extracto como
 * cargo de 1.000 y como abono de 200. Agrupando sólo por glosa, las dos filas
 * compartían un único veredicto y el abono salía rotulado «Transferencia
 * enviada»: la tabla afirmaba que un ingreso era un egreso.
 */
export function claveMovimiento(movimiento: MovimientoAClasificar): string {
  return `${claveGlosa(movimiento.descripcion)}|${movimiento.movementType}`;
}

/** Glosas que ya declaran su sentido; anteponerlo otra vez sólo sería ruido. */
const SENTIDO_YA_DICHO = /^(d[eé]bito|cr[eé]dito|abono|cargo|n\/[dc]|dep[oó]sito|retiro)\b/i;

/**
 * El texto que se manda a clasificar.
 *
 * Cuando la glosa no dice el sentido, se antepone el que el banco ya declaró en
 * la columna «Tipo». No es una invención: es el mismo dato de la misma fila, y
 * es exactamente el vocabulario con el que otros bancos lo escriben —el
 * Mercantil imprime `DEBITO TRANSFERENCIA ACH` y `CREDITO TRANSFERENCIA ACH`
 * para distinguir lo que el Económico deja ambiguo—. Sin esto, el clasificador
 * ve dos veces el mismo texto y no tiene forma de acertar en las dos.
 */
function textoAClasificar(movimiento: MovimientoAClasificar): string {
  const glosa = claveGlosa(movimiento.descripcion);
  if (SENTIDO_YA_DICHO.test(glosa)) return glosa;
  if (movimiento.movementType === 'CREDIT') return `CREDITO ${glosa}`;
  if (movimiento.movementType === 'DEBIT') return `DEBITO ${glosa}`;
  return glosa;
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

  const clasificar = useCallback(async (movimientos: readonly MovimientoAClasificar[]) => {
    // Un caso por (glosa, sentido): el mismo texto en dos direcciones son dos
    // preguntas distintas, y la repetición dentro de una dirección sigue siendo
    // una sola.
    const casos = [
      ...new Map(
        movimientos
          .filter((movimiento) => claveGlosa(movimiento.descripcion) !== '')
          .map((movimiento) => [
            claveMovimiento(movimiento),
            { clave: claveMovimiento(movimiento), texto: textoAClasificar(movimiento) },
          ]),
      ).values(),
    ];

    if (casos.length > MAX_GLOSAS) {
      setEstado({ ...VACIO, demasiadas: casos.length });
      return;
    }
    if (casos.length === 0) return;

    const marca = Date.now().toString(36);
    cortado.current = false;
    setEstado({
      veredictos: Object.fromEntries(
        casos.map((caso) => [caso.clave, { fase: 'esperando' as const }]),
      ),
      corriendo: true,
      hechas: 0,
      total: casos.length,
      demasiadas: null,
    });

    const anotar = (clave: string, veredicto: VeredictoCategoria) =>
      setEstado((previo) => ({
        ...previo,
        veredictos: { ...previo.veredictos, [clave]: veredicto },
        hechas:
          previo.hechas + (veredicto.fase === 'esperando' || veredicto.fase === 'en-curso' ? 0 : 1),
      }));

    // Un turno por hueco: cada uno toma el siguiente caso libre hasta agotarlos.
    let siguiente = 0;
    const turno = async () => {
      while (!cortado.current) {
        const indice = siguiente++;
        if (indice >= casos.length) return;
        const caso = casos[indice] as (typeof casos)[number];
        anotar(caso.clave, { fase: 'en-curso' });
        anotar(
          caso.clave,
          await clasificarUna(caso.texto, () => cortado.current, claveDeTanda(caso.texto, marca)),
        );
      }
    };

    await Promise.all(Array.from({ length: Math.min(EN_VUELO, casos.length) }, turno));
    setEstado((previo) => ({ ...previo, corriendo: false }));
  }, []);

  return { ...estado, clasificar, parar, limpiar, maxGlosas: MAX_GLOSAS };
}

/** Encola una glosa y la sigue hasta que el motor la da por terminada. */
async function clasificarUna(
  glosa: string,
  hayQueParar: () => boolean,
  idempotencyKey: string,
): Promise<VeredictoCategoria> {
  try {
    const creada = await createSemanticRun({ text: glosa, idempotencyKey });
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
