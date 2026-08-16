'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PORTAL_LOCALE } from '../../config/locale';
import { clasificarTanda, type Caso, type VeredictoCategoria } from './classify-batch';

export type { VeredictoCategoria } from './classify-batch';

/**
 * Clasifica los movimientos de un extracto contra el semántico, por lotes.
 *
 * **Esto es orquestación de cliente, y conviene saber por qué.** El motor no
 * publica ninguna ruta «extracto → categorías»: el de extractos devuelve
 * movimientos sin categoría y el semántico clasifica un texto por ejecución. La
 * forma que el motor documenta para componer dos workers es un grafo con un
 * nodo `WORKER` (`EXTRACTO_CAPACIDAD_PAGO` lo demuestra), no un bucle en una
 * pantalla. Mientras esa pieza no exista, esto encadena aquí lo que allí no está
 * encadenado — y por eso se comporta con el cuidado que orquestar sobre una API
 * ajena exige: deduplica, se puede parar y dice cuánto dejó fuera.
 *
 * ## Por qué ya no va de una en una
 *
 * La versión anterior abría una ejecución por glosa y sondeaba cada una por
 * separado, con cuatro en vuelo como máximo para no agotar el limitador de tasa
 * del motor. Ciento veinte glosas eran, contando sondeos, del orden de
 * quinientas peticiones, y la espera no la marcaba lo que tarda el motor en
 * clasificar sino el ritmo del sondeo multiplicado por las tandas: minutos para
 * un trabajo de segundos. Y cuando el limitador saltaba, los 429 llegaban a la
 * tabla como «No se pudo», que describe un fallo de clasificación que no había
 * ocurrido.
 *
 * Ahora el alta es UNA petición para todo el lote y el sondeo es UNA petición
 * para todas las ejecuciones. El número de peticiones deja de crecer con el
 * tamaño del extracto, y con él desaparecen a la vez la espera y los 429.
 *
 * ## Lo que se conserva
 *
 * - **Deduplica por glosa y sentido.** Un extracto repite «COMISION
 *   MANTENIMIENTO» doce veces; clasificarla doce veces son once ejecuciones que
 *   dicen lo mismo.
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
 *   arreglarlo por más que se pulsara. Por eso cada tanda manda su propia clave
 *   de idempotencia, que es la vía que el motor documenta para forzar el
 *   reanálisis. Reanalizar hoy además es barato: el motor recuerda el veredicto
 *   mientras el catálogo no cambie, así que una tanda repetida sin cambios se
 *   resuelve sin volver a llamar al modelo.
 */

/**
 * Glosas distintas que se aceptan de una vez.
 *
 * Ya no lo fija el limitador de tasa —el lote gasta una petición para el alta y
 * una por sondeo, no una por glosa— sino lo que cabe en una tabla que alguien va
 * a leer. Se manda en lotes de `MAX_SEMANTIC_BATCH`, que es lo que el motor
 * acepta por petición.
 */
const MAX_GLOSAS = 600;
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

interface Estado {
  veredictos: Record<string, VeredictoCategoria>;
  corriendo: boolean;
  hechas: number;
  total: number;
  /**
   * Glosas que la pantalla dejó de esperar y quedaron en revisión.
   *
   * Se cuenta aparte de `hechas` porque no es lo mismo: `hechas` mide avance
   * —cuánto queda por delante— y esto mide cuánto trabajo se desvió a una
   * persona. Sumarlas dejaría la barra al 100 % sin que nadie se enterara de que
   * un tercio de la tabla está sin clasificar.
   */
  enRevision: number;
  /** Glosas distintas que había cuando se rechazó empezar, o `null` si cabían. */
  demasiadas: number | null;
}

const VACIO: Estado = {
  veredictos: {},
  corriendo: false,
  hechas: 0,
  total: 0,
  enRevision: 0,
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
    const casos: Caso[] = [
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
      enRevision: 0,
      demasiadas: null,
    });

    const anotar = (nuevos: Readonly<Record<string, VeredictoCategoria>>) => {
      if (Object.keys(nuevos).length === 0) return;
      setEstado((previo) => {
        const veredictos = { ...previo.veredictos, ...nuevos };
        const fases = Object.values(veredictos);
        return {
          ...previo,
          veredictos,
          // Se recuenta sobre el mapa entero en vez de ir sumando: el mismo
          // veredicto puede llegar dos veces —un sondeo que se solapa con el
          // anterior— y un contador incremental lo contaría dos veces, dejando
          // la barra de progreso por encima del total.
          hechas: fases.filter(
            (veredicto) => veredicto.fase === 'listo' || veredicto.fase === 'fallido',
          ).length,
          enRevision: fases.filter((veredicto) => veredicto.fase === 'revision').length,
        };
      });
    };

    try {
      await clasificarTanda({
        casos,
        claveDe: (texto) => claveDeTanda(texto, marca),
        hayQueParar: () => cortado.current,
        anotar,
      });
    } catch (error) {
      // El alta del lote falló entera: sin ejecuciones que sondear, lo honesto
      // es decirlo en cada fila en vez de dejarlas en «esperando» para siempre.
      const motivo = error instanceof Error ? error.message : 'Error inesperado';
      anotar(
        Object.fromEntries(casos.map((caso) => [caso.clave, { fase: 'fallido', error: motivo }])),
      );
    }
    setEstado((previo) => ({ ...previo, corriendo: false }));
  }, []);

  return { ...estado, clasificar, parar, limpiar, maxGlosas: MAX_GLOSAS };
}
