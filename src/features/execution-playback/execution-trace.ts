import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import type { EdgeRuntimeMap, NodeRuntimeMap, NodeRunStatus } from '../graph-editor/node-runtime';

/**
 * Traducción de la trazabilidad del backend al modelo que consume la
 * reproducción visual.
 *
 * Todo lo que se anima sale de aquí: si el motor no reportó un paso, el paso no
 * existe y su nodo se pinta como no ejecutado. Nunca se completa el recorrido
 * con suposiciones — un grafo que animara caminos inventados sería peor que uno
 * estático, porque mentiría con aire de autoridad.
 */

export interface TraceStep {
  index: number;
  nodeKey: string;
  nodeType: string;
  status: NodeRunStatus;
  durationMs?: number;
  /** Rama elegida por el motor al salir del nodo. */
  branchTaken?: string;
  /** Aristas que el motor evaluó y descartó en este paso. */
  discardedEdgeKeys: string[];
  input?: unknown;
  output?: unknown;
  outcome?: string;
  error?: string;
  /** Versión del algoritmo invocado, si el paso llamó a otro algoritmo. */
  referenceVersionId?: string;
  /** `true` cuando el paso derivó el caso a una persona. */
  manualReview: boolean;
}

const STATUS_MAP: Record<string, NodeRunStatus> = {
  COMPLETED: 'done',
  COMPLETE: 'done',
  OK: 'done',
  SUCCESS: 'done',
  PASSED: 'done',
  EVALUATED: 'done',
  RUNNING: 'running',
  IN_PROGRESS: 'running',
  STARTED: 'running',
  SKIPPED: 'skipped',
  NOT_EXECUTED: 'skipped',
  WARNING: 'warning',
  WARN: 'warning',
  ERROR: 'error',
  FAILED: 'error',
  FAILURE: 'error',
};

function statusOf(raw: UnknownRecord): NodeRunStatus {
  const text = String(raw.status ?? raw.outcome ?? '').toUpperCase();
  if (STATUS_MAP[text]) return STATUS_MAP[text];
  // El motor no siempre etiqueta el estado; un paso con mensaje de error lo es
  // aunque venga sin `status`.
  if (raw.errorMessage || raw.error) return 'error';
  return 'done';
}

/** Los `BigInt` del backend (`durationUs`) llegan serializados como texto. */
function numberOf(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function durationOf(raw: UnknownRecord): number | undefined {
  const ms = numberOf(raw.durationMs);
  if (ms !== undefined) return ms;
  const us = numberOf(raw.durationUs);
  return us === undefined ? undefined : Math.round(us / 1000);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry)).filter(Boolean);
}

function firstShown(...values: string[]): string {
  return values.find((value) => value !== '—') ?? '—';
}

/** Extrae los pasos de una ejecución tal y como los devuelve `/v1/audit/executions/:id`. */
export function normalizeTrace(execution: unknown): TraceStep[] {
  const record = asRecord(execution);
  const rows = asRows(record.traceSteps ?? record.trace ?? record.steps);
  return rows.map((raw, index) => {
    // La auditoría persiste cada paso como `decision_execution_step`: la clave y
    // el tipo del nodo viven en `node`, y lo evaluado en `evaluationResultJson`.
    // `nodeId` es la clave primaria de la fila del nodo, no su clave en el grafo:
    // usarla como `nodeKey` dejaba la reproducción sin ningún nodo que encender.
    const node = asRecord(raw.node);
    const nodeKey = firstShown(display(raw, 'nodeKey'), display(node, 'nodeKey', 'key'));
    const nodeType = firstShown(
      display(raw, 'nodeType', 'type'),
      display(node, 'nodeType', 'type'),
    );
    const error = raw.errorMessage ?? raw.error;
    return {
      index,
      nodeKey: nodeKey === '—' ? `paso-${index + 1}` : nodeKey,
      nodeType,
      status: statusOf(raw),
      durationMs: durationOf(raw),
      branchTaken: raw.branchTaken ? String(raw.branchTaken) : undefined,
      discardedEdgeKeys: stringList(raw.discardedEdgeKeys ?? raw.discardedEdges),
      input: raw.inputJson ?? raw.input ?? raw.variables,
      output: raw.outputJson ?? raw.output ?? raw.result ?? raw.evaluationResultJson,
      outcome: raw.outcome ? String(raw.outcome) : undefined,
      error: error ? String(error) : undefined,
      referenceVersionId: raw.childArtifactVersionId
        ? String(raw.childArtifactVersionId)
        : undefined,
      manualReview: nodeType === 'MANUAL_REVIEW' || Boolean(raw.manualReviewRequired),
    };
  });
}

/**
 * Estado de cada nodo del grafo en el paso `cursor` de la reproducción.
 *
 * Un nodo que la traza nunca menciona sólo se marca como omitido cuando la
 * reproducción llega al final: antes de eso todavía podría ejecutarse, y
 * anticiparlo sería inventar.
 */
export function runtimeAt(
  steps: TraceStep[],
  cursor: number,
  nodeKeys: string[],
  options: { completed?: boolean } = {},
): NodeRuntimeMap {
  // En una reproducción, llegar al último paso significa que la ejecución ya
  // terminó. En una ejecución en vivo no: el último paso conocido es
  // simplemente el más reciente, y todavía pueden llegar más.
  const finished = options.completed ?? cursor >= steps.length - 1;
  const map: NodeRuntimeMap = {};
  for (const key of nodeKeys) {
    map[key] = { status: finished ? 'skipped' : 'pending' };
  }
  steps.forEach((step) => {
    if (step.index > cursor) {
      map[step.nodeKey] = { status: 'pending' };
      return;
    }
    const current = step.index === cursor;
    // El cursor se pinta "en ejecución" salvo que el propio paso terminase en
    // error o advertencia: en ese caso manda el desenlace real.
    const status: NodeRunStatus =
      current && step.status !== 'error' && step.status !== 'warning' ? 'running' : step.status;
    map[step.nodeKey] = {
      status,
      durationMs: step.durationMs,
      outcome: step.outcome ?? step.branchTaken,
      error: step.error,
      detail: stepDetail(step, current),
    };
  });
  return map;
}

function stepDetail(step: TraceStep, current: boolean): string {
  if (step.error) return `El paso falló: ${step.error}`;
  if (current) return 'Paso que se está reproduciendo ahora mismo.';
  if (step.branchTaken) return `El motor continuó por «${step.branchTaken}».`;
  if (step.referenceVersionId) return 'Este paso invocó otro algoritmo y esperó su respuesta.';
  if (step.manualReview) return 'El caso se derivó a revisión de una persona.';
  return 'Paso evaluado durante esta ejecución.';
}

/**
 * Estado de cada arista: recorrida, descartada o todavía sin evaluar.
 *
 * Se toma por recorrida la arista que une dos pasos consecutivos de la traza, y
 * por descartada la que el motor reportó explícitamente en `discardedEdgeKeys`
 * o cualquier otra salida de un nodo ya ejecutado.
 */
export function edgeRuntimeAt(
  steps: TraceStep[],
  cursor: number,
  edges: UnknownRecord[],
): EdgeRuntimeMap {
  const map: EdgeRuntimeMap = {};
  const visited = steps.filter((step) => step.index <= cursor);
  const visitedKeys = new Set(visited.map((step) => step.nodeKey));
  const pairs = new Set<string>();
  for (let i = 0; i < visited.length - 1; i += 1) {
    pairs.add(`${visited[i].nodeKey}→${visited[i + 1].nodeKey}`);
  }
  const discarded = new Set(visited.flatMap((step) => step.discardedEdgeKeys));

  for (const edge of edges) {
    const key = display(edge, 'key');
    const from = display(edge, 'from');
    const to = display(edge, 'to');
    if (pairs.has(`${from}→${to}`)) map[key] = 'taken';
    else if (discarded.has(key) || visitedKeys.has(from)) map[key] = 'discarded';
    else map[key] = 'pending';
  }
  return map;
}
