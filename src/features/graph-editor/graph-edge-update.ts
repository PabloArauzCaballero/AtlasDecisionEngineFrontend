import { display, type UnknownRecord } from '../../utils/records';

interface UpdateSiblingEdgeInput {
  edge: UnknownRecord;
  current: UnknownRecord;
  patch: UnknownRecord;
  selectedEdgeKey: string;
  sourceKey: string;
  sourceConditionCode: string;
  firstSibling?: UnknownRecord;
}

/**
 * Updates one outgoing edge while preserving the single-default invariant.
 */
export function updateSiblingEdge(input: UpdateSiblingEdgeInput): UnknownRecord {
  const { edge, current, patch, selectedEdgeKey, sourceKey, sourceConditionCode, firstSibling } =
    input;
  if (display(edge, 'key') === selectedEdgeKey) return { ...edge, ...patch };
  if (display(edge, 'from') !== sourceKey || patch.default === undefined) return edge;

  if (patch.default === true && edge.default && sourceConditionCode) {
    return {
      ...edge,
      type: 'CONDITIONAL',
      default: false,
      conditions: [{ code: sourceConditionCode, order: 1 }],
    };
  }

  if (patch.default === false && current.default && edge === firstSibling) {
    return { ...edge, type: 'DEFAULT', default: true, conditions: [] };
  }

  return edge;
}
