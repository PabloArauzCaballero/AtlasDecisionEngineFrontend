import { asRecord, asRows, asStrings } from '../../utils/records';
import { MOTIVO_REVISION, inicioDelPlazo, plazoAgotado } from './gloss-review';
import { isTerminal, type WorkerRun } from './worker-types';
import {
  MAX_SEMANTIC_BATCH,
  createSemanticRunBatch,
  fetchSemanticRunStatuses,
} from './workers.api';

/**
 * Encola una tanda de glosas y la sigue hasta que cada una tiene desenlace.
 *
 * Vive fuera del hook por dos razones y las dos importan: es lógica pura de
 * orquestación —se puede probar sin montar un componente— y el hook había
 * crecido por encima del techo de líneas del repositorio arrastrando todo esto
 * dentro.
 *
 * ## Los tres desenlaces, y por qué no son dos
 *
 * - **listo** — el motor respondió.
 * - **fallido** — la ejecución terminó mal, o el motor ya no la encuentra.
 * - **revisión** — el motor sigue trabajando pero la pantalla dejó de esperar.
 *
 * El tercero es la razón de este archivo. Antes no existía: una glosa lenta
 * dejaba su fila girando sin límite, y con ella la tabla entera a medio
 * clasificar. Esperar indefinidamente no es más honesto que rendirse —es peor:
 * bloquea a quien mira sin darle nada que hacer—. Ahora se suelta con motivo, la
 * ejecución NO se cancela (el motor la termina y el término cae en la bandeja de
 * pendientes) y la pantalla vuelve a ser utilizable.
 *
 * Y no se colapsa con «fallido» a propósito: un fallo se reintenta, una revisión
 * se atiende. Pintarlos igual manda a la persona equivocada a hacer lo que no
 * era.
 */

/** Ritmo del sondeo, que cubre el lote entero en una petición. */
const SONDEO_INICIAL_MS = 400;
const SONDEO_MAXIMO_MS = 2_000;
const SONDEO_FACTOR = 1.3;

export interface VeredictoCategoria {
  fase: 'esperando' | 'en-curso' | 'listo' | 'fallido' | 'revision';
  /** Veredicto del semántico: `MATCH`, `AMBIGUOUS`, `UNKNOWN`… */
  estado?: string;
  categoria?: string;
  /** Ruta legible de la categoría, de la raíz a la hoja. */
  ruta?: readonly string[];
  confianza?: number;
  error?: string;
  /** Por qué quedó en revisión. Sólo con `fase: 'revision'`. */
  motivo?: string;
}

export interface Caso {
  readonly clave: string;
  readonly texto: string;
}

export interface OpcionesDeTanda {
  casos: readonly Caso[];
  /** Clave de idempotencia común a la tanda: deduplica dentro, no entre tandas. */
  claveDe: (texto: string) => string;
  hayQueParar: () => boolean;
  anotar: (nuevos: Readonly<Record<string, VeredictoCategoria>>) => void;
  /** Inyectable para poder probar el plazo sin esperarlo de verdad. */
  ahora?: () => number;
  presupuestoMs?: number;
}

/**
 * El alta va en lotes del tamaño que el motor acepta; el sondeo pregunta SÓLO
 * por lo que sigue vivo, de modo que la petición se encoge según terminan las
 * ejecuciones en vez de repetir el lote completo hasta el final.
 *
 * Cada veredicto se anota en cuanto llega. Esperar a tenerlos todos dejaría la
 * tabla congelada durante toda la tanda y luego se rellenaría de golpe, que se
 * lee como que no estaba pasando nada.
 */
export async function clasificarTanda(opciones: OpcionesDeTanda): Promise<void> {
  const { casos, claveDe, hayQueParar, anotar } = opciones;
  const ahora = opciones.ahora ?? (() => Date.now());
  const porEjecucion = new Map<string, string>();

  for (let inicio = 0; inicio < casos.length; inicio += MAX_SEMANTIC_BATCH) {
    if (hayQueParar()) return;
    const lote = casos.slice(inicio, inicio + MAX_SEMANTIC_BATCH);
    const creadas = await createSemanticRunBatch(
      lote.map((caso) => ({ text: caso.texto, idempotencyKey: claveDe(caso.texto) })),
    );
    // El motor devuelve las ejecuciones en el orden en que se pidieron, así que
    // la posición es lo que empareja cada una con su glosa. Si devolviera menos
    // —una glosa que no llegó a encolarse—, esa se queda sin ejecución y el
    // cierre de más abajo la marca como fallida en vez de dejarla colgada.
    creadas.forEach((ejecucion, indice) => {
      const caso = lote[indice];
      if (caso !== undefined) porEjecucion.set(ejecucion.requestId, caso.clave);
    });
    anotar(
      Object.fromEntries(
        creadas.flatMap((ejecucion, indice) => {
          const caso = lote[indice];
          return caso === undefined ? [] : [[caso.clave, { fase: 'en-curso' as const }]];
        }),
      ),
    );
  }

  const pendientes = new Set(porEjecucion.keys());
  /** Cuándo empezó a correr cada ejecución. Mientras está en cola, `null`. */
  const arranques = new Map<string, number | null>([...pendientes].map((id) => [id, null]));
  let esperaMs = SONDEO_INICIAL_MS;

  while (pendientes.size > 0) {
    await new Promise((listo) => setTimeout(listo, esperaMs));
    if (hayQueParar()) {
      anotar(cierreDe(pendientes, porEjecucion, { fase: 'fallido', error: 'Cancelado' }));
      return;
    }

    const ejecuciones = await fetchSemanticRunStatuses([...pendientes]);
    const instante = ahora();
    const nuevos: Record<string, VeredictoCategoria> = {};

    for (const ejecucion of ejecuciones) {
      const clave = porEjecucion.get(ejecucion.requestId);
      if (clave === undefined) continue;

      if (isTerminal(ejecucion.status)) {
        pendientes.delete(ejecucion.requestId);
        nuevos[clave] = veredictoDe(ejecucion);
        continue;
      }

      // Sigue viva. El reloj sólo corre desde que dejó la cola: lo que espera
      // turno no es una glosa lenta, es una cola larga, y mandar eso a revisión
      // llenaría la bandeja de casos que nadie tiene que mirar.
      const arranque = inicioDelPlazo(
        ejecucion.status,
        instante,
        arranques.get(ejecucion.requestId) ?? null,
      );
      arranques.set(ejecucion.requestId, arranque);
      if (plazoAgotado(arranque, instante, opciones.presupuestoMs)) {
        /*
         * Se suelta SIN cancelar. Cancelar tiraría un trabajo que va a terminar
         * —y que, si acaba sin confianza, el motor deja en la bandeja de
         * pendientes con su motivo—; lo único que sobra aquí es la espera.
         */
        pendientes.delete(ejecucion.requestId);
        nuevos[clave] = { fase: 'revision', motivo: MOTIVO_REVISION.TIMEOUT };
      }
    }
    anotar(nuevos);

    // Una ejecución que el motor ya no encuentra no va a terminar nunca: sin
    // esto el bucle sondearía en vano hasta que alguien cierre la pantalla.
    const vistas = new Set(ejecuciones.map((ejecucion) => ejecucion.requestId));
    const perdidas = [...pendientes].filter((requestId) => !vistas.has(requestId));
    if (perdidas.length > 0) {
      const desaparecidas = new Set(perdidas);
      perdidas.forEach((requestId) => pendientes.delete(requestId));
      anotar(
        cierreDe(desaparecidas, porEjecucion, {
          fase: 'fallido',
          error: 'El motor no encuentra esta ejecución.',
        }),
      );
    }

    esperaMs = Math.min(Math.round(esperaMs * SONDEO_FACTOR), SONDEO_MAXIMO_MS);
  }
}

/** El mismo veredicto para todas las ejecuciones que quedaron sin cerrar. */
function cierreDe(
  ejecuciones: ReadonlySet<string>,
  porEjecucion: ReadonlyMap<string, string>,
  veredicto: VeredictoCategoria,
): Record<string, VeredictoCategoria> {
  return Object.fromEntries(
    [...ejecuciones].flatMap((requestId) => {
      const clave = porEjecucion.get(requestId);
      return clave === undefined ? [] : [[clave, veredicto]];
    }),
  );
}

function veredictoDe(ejecucion: WorkerRun): VeredictoCategoria {
  if (ejecucion.status === 'FAILED' || ejecucion.status === 'CANCELLED') {
    return {
      fase: 'fallido',
      error: ejecucion.errorMessage ?? ejecucion.errorCode ?? 'La ejecución no terminó bien.',
    };
  }
  return leerVeredicto(ejecucion.result);
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
