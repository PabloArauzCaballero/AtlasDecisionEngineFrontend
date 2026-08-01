import type { LiveNodeStep } from '../../components/LiveNodeStepList';
import type { TraceStep } from './execution-trace';

/**
 * Convierte los eventos de una ejecución en vivo (SSE) al mismo modelo de pasos
 * que usa la reproducción de ejecuciones ya registradas.
 *
 * Así el grafo en vivo y el grafo de auditoría comparten componente, estados y
 * animaciones: lo que el usuario aprende viendo una ejecución en directo le
 * sirve tal cual cuando después la audita.
 *
 * El motor puede reenviar el mismo nodo (primero `RUNNING`, luego `COMPLETED`).
 * Se conserva un único paso por nodo, con su estado más reciente, para que la
 * línea de tiempo no muestre el mismo bloque dos veces.
 */
const STATUS = { RUNNING: 'running', COMPLETED: 'done', ERROR: 'error' } as const;

export function liveTrace(events: LiveNodeStep[]): TraceStep[] {
  const byNode = new Map<string, TraceStep>();
  for (const event of events) {
    const existing = byNode.get(event.nodeKey);
    const step: TraceStep = {
      index: existing?.index ?? byNode.size,
      nodeKey: event.nodeKey,
      nodeType: event.nodeType,
      status: STATUS[event.status],
      branchTaken: event.branchTaken ?? existing?.branchTaken,
      discardedEdgeKeys: event.discardedEdgeKeys ?? existing?.discardedEdgeKeys ?? [],
      error: event.errorMessage ?? existing?.error,
      manualReview: event.nodeType === 'MANUAL_REVIEW',
    };
    byNode.set(event.nodeKey, step);
  }
  return [...byNode.values()].sort((a, b) => a.index - b.index);
}

/**
 * Versión del algoritmo que la propia traza declara, si el motor la envía. El
 * evento no la incluye siempre; cuando falta, la vista pide al usuario que elija
 * la versión en lugar de adivinarla.
 */
export function versionIdFromEvent(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const candidate = record.artifactVersionId ?? record.versionId;
  return typeof candidate === 'string' && candidate ? candidate : null;
}
