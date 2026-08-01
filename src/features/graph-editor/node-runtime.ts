/**
 * Estado de ejecución de un nodo y de una arista.
 *
 * Es el contrato que une la trazabilidad real del backend con la capa visual:
 * el lienzo no sabe de ejecuciones, sólo pinta el estado que recibe. Nada de
 * esto se inventa en el cliente — si no hay traza, no hay estado y el grafo se
 * dibuja en reposo.
 */

export type NodeRunStatus = 'pending' | 'running' | 'done' | 'skipped' | 'warning' | 'error';

export interface NodeRuntime {
  status: NodeRunStatus;
  /** Duración medida por el motor, cuando la traza la reporta. */
  durationMs?: number;
  /** Resultado o rama tomada, tal y como la nombró el motor. */
  outcome?: string;
  /** Mensaje de error del nodo, si falló. */
  error?: string;
  /** Explicación para el tooltip: por qué este nodo está en este estado. */
  detail?: string;
}

export type NodeRuntimeMap = Record<string, NodeRuntime>;

/** `taken`: camino recorrido. `discarded`: descartado por la condición. */
export type EdgeRunStatus = 'taken' | 'discarded' | 'pending';

export type EdgeRuntimeMap = Record<string, EdgeRunStatus>;

const STATUS_LABELS: Record<NodeRunStatus, string> = {
  pending: 'Pendiente',
  running: 'En ejecución',
  done: 'Completado',
  skipped: 'Omitido',
  warning: 'Con advertencia',
  error: 'Con error',
};

export function runStatusLabel(status: NodeRunStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Explicación por defecto de un estado. Las trazas que traen su propio motivo
 * (`detail`) lo sobrescriben; esto sólo cubre el caso en que el backend no
 * explicó nada.
 */
const STATUS_HINTS: Record<NodeRunStatus, string> = {
  pending: 'Todavía no se ha llegado a este paso.',
  running: 'El motor está evaluando este paso ahora mismo.',
  done: 'El paso se evaluó correctamente.',
  skipped: 'Este paso no se ejecutó porque la condición anterior no se cumplió.',
  warning: 'El paso terminó, pero dejó una advertencia que conviene revisar.',
  error: 'El paso falló y detuvo el recorrido por este camino.',
};

export function runStatusHint(runtime: NodeRuntime): string {
  return runtime.detail ?? STATUS_HINTS[runtime.status];
}
