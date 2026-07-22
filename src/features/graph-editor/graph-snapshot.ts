import type { UnknownRecord } from '../../utils/records';

export function withNodes(snapshot: UnknownRecord, nodes: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, nodes };
}

export function withEdges(snapshot: UnknownRecord, edges: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, edges };
}
