import { asRecord, display, type UnknownRecord } from '../../utils/records';

interface Position {
  x: number;
  y: number;
}

export interface NodeDraft {
  node: UnknownRecord;
  condition?: UnknownRecord;
}

export type EdgeCreationError =
  | 'SAME_NODE'
  | 'DUPLICATE_EDGE'
  | 'SOURCE_NOT_FOUND'
  | 'TERMINAL_SOURCE'
  | 'TOO_MANY_BRANCHES'
  | 'SOURCE_IS_NOT_CONDITIONAL'
  | 'PROHIBITED_CYCLE';

export interface EdgeDraft {
  edge: UnknownRecord;
  condition?: UnknownRecord;
}

/** Maximum outgoing branches allowed from a SWITCH node (cases + default). */
export const MAX_SWITCH_BRANCHES = 12;

/**
 * Builds the key the backend stores for an edge. The separator must stay within
 * `[A-Za-z0-9_-]`: the Decision Engine rejects anything else on `PUT .../graph`.
 * Node keys never contain a double underscore, so the pair stays unambiguous.
 */
export function edgeKeyFor(from: string, to: string): string {
  return `${from}__${to}`;
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
  const inputCode = inputs[0] ? display(inputs[0], 'code') : '';
  if (type === 'SWITCH') {
    // A switch routes on a single variable; each branch carries its own case
    // condition, created as the switch is connected to targets.
    node.config = { variable: inputCode };
    return { node };
  }
  if (type !== 'CONDITION') return { node };

  const conditionCode = `${key}_EXPR`.toUpperCase();
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
): EdgeDraft | null {
  const error = edgeCreationError(from, to, nodes, edges, conditions);
  if (error) return null;

  const baseKey = edgeKeyFor(from, to);
  const source = nodes.find((node) => display(node, 'key') === from);
  if (!source) return null;
  const outgoing = edges.filter((edge) => display(edge, 'from') === from);

  // A switch keeps its first edge as the fail-closed default and turns every
  // later branch into a case with a freshly created equality condition.
  if (String(source.type) === 'SWITCH') {
    if (!outgoing.length) {
      return {
        edge: {
          key: baseKey,
          from,
          to,
          type: 'DEFAULT',
          priority: 1,
          default: true,
          conditions: [],
        },
      };
    }
    const caseIndex = outgoing.filter((edge) => !edge.default).length + 1;
    const conditionCode = `${from}_CASE_${caseIndex}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    const switchVariable = String(asRecord(source.config).variable ?? '');
    return {
      edge: {
        key: baseKey,
        from,
        to,
        type: 'CONDITIONAL',
        priority: caseIndex,
        default: false,
        conditions: [{ code: conditionCode, order: 1 }],
      },
      condition: {
        code: conditionCode,
        name: `Caso ${caseIndex} · ${from}`,
        expressionType: 'JSON_AST',
        expression: { variable: switchVariable, operator: 'eq', value: '' },
        severity: 'BLOCKING',
        reusable: false,
      },
    };
  }

  const sourceConditionCode = String(asRecord(source.config).conditionCode ?? '');
  const availableCondition = conditions.find(
    (condition) => display(condition, 'code') === sourceConditionCode,
  );
  const conditional = outgoing.length > 0 && Boolean(availableCondition);

  return {
    edge: {
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
    },
  };
}

export function edgeCreationError(
  from: string,
  to: string,
  nodes: UnknownRecord[],
  edges: UnknownRecord[],
  conditions: UnknownRecord[],
): EdgeCreationError | null {
  if (from === to) return 'SAME_NODE';

  const baseKey = edgeKeyFor(from, to);
  if (edges.some((edge) => display(edge, 'key') === baseKey)) return 'DUPLICATE_EDGE';

  const source = nodes.find((node) => display(node, 'key') === from);
  if (!source) return 'SOURCE_NOT_FOUND';
  if (source.terminal || ['RESULT', 'END', 'MANUAL_REVIEW'].includes(String(source.type))) {
    return 'TERMINAL_SOURCE';
  }

  if (wouldCreateCycle(from, to, edges)) return 'PROHIBITED_CYCLE';

  const outgoing = edges.filter((edge) => display(edge, 'from') === from);

  // A switch fans out to many cases; each branch gets its own condition, so the
  // "must already be conditional" rule that guards binary CONDITION nodes does
  // not apply here.
  if (String(source.type) === 'SWITCH') {
    return outgoing.length >= MAX_SWITCH_BRANCHES ? 'TOO_MANY_BRANCHES' : null;
  }

  if (outgoing.length >= 2) return 'TOO_MANY_BRANCHES';
  if (!outgoing.length) return null;

  const sourceConditionCode = String(asRecord(source.config).conditionCode ?? '');
  const hasCondition = conditions.some(
    (condition) => display(condition, 'code') === sourceConditionCode,
  );
  return hasCondition ? null : 'SOURCE_IS_NOT_CONDITIONAL';
}

function wouldCreateCycle(from: string, to: string, edges: UnknownRecord[]): boolean {
  const pending = [to];
  const visited = new Set<string>();

  while (pending.length) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === from) return true;
    visited.add(current);
    for (const edge of edges) {
      if (display(edge, 'from') === current) pending.push(display(edge, 'to'));
    }
  }

  return false;
}
