import { asRecord, display, type UnknownRecord } from '../../utils/records';

interface Position {
  x: number;
  y: number;
}

export interface NodeDraft {
  node: UnknownRecord;
  condition?: UnknownRecord;
}

function nextKey(type: string, nodes: UnknownRecord[]): string {
  if (type === 'START' && !nodes.some((node) => node.type === 'START')) return 'START';
  let suffix = 1;
  while (nodes.some((node) => display(node, 'key') === `${type}_${suffix}`)) suffix += 1;
  return `${type}_${suffix}`;
}

export function createNodeDraft(
  type: string,
  nodes: UnknownRecord[],
  inputs: UnknownRecord[],
  position?: Position,
): NodeDraft {
  const key = nextKey(type, nodes);
  const terminal = type === 'RESULT' || type === 'END' || type === 'MANUAL_REVIEW';
  const node: UnknownRecord = {
    key,
    type,
    label: type === 'START' ? 'Start' : `${type.replace(/_/g, ' ')} ${key.split('_').at(-1)}`,
    config: {},
    x: position?.x ?? 10 + ((nodes.length * 14) % 70),
    y: position?.y ?? 14 + ((nodes.length * 11) % 60),
    order: nodes.length + 1,
    terminal,
    conditions: [],
    actions: [],
  };

  if (type === 'RESULT') node.config = { mode: 'MAPPING', assignments: [] };
  if (type !== 'CONDITION') return { node };

  const conditionCode = `${key}_EXPR`.toUpperCase();
  const inputCode = inputs[0] ? display(inputs[0], 'code') : '';
  node.config = { conditionCode };
  return {
    node,
    condition: {
      code: conditionCode,
      name: `Condition for ${node.label}`,
      expressionType: 'JSON_AST',
      expression: { variable: inputCode, operator: 'gte', value: 0 },
      severity: 'BLOCKING',
      reusable: false,
    },
  };
}

export function createEdgeDraft(
  from: string,
  to: string,
  nodes: UnknownRecord[],
  edges: UnknownRecord[],
  conditions: UnknownRecord[],
): UnknownRecord | null {
  const baseKey = `${from}->${to}`;
  if (from === to || edges.some((edge) => display(edge, 'key') === baseKey)) return null;
  const source = nodes.find((node) => display(node, 'key') === from);
  if (
    !source ||
    source.terminal ||
    ['RESULT', 'END', 'MANUAL_REVIEW'].includes(String(source.type))
  ) {
    return null;
  }

  const outgoing = edges.filter((edge) => display(edge, 'from') === from);
  const sourceConditionCode = String(asRecord(source.config).conditionCode ?? '');
  const availableCondition = conditions.find(
    (condition) => display(condition, 'code') === sourceConditionCode,
  );
  if (outgoing.length >= 2) return null;
  const conditional = outgoing.length > 0 && Boolean(availableCondition);
  if (outgoing.length > 0 && !conditional) return null;

  return {
    key: baseKey,
    from,
    to,
    type: conditional ? 'CONDITIONAL' : 'DEFAULT',
    priority: outgoing.length + 1,
    default: !conditional,
    conditions:
      conditional && availableCondition
        ? [{ code: display(availableCondition, 'code'), order: 1 }]
        : [],
  };
}
