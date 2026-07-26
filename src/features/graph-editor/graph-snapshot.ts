import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

export function withNodes(snapshot: UnknownRecord, nodes: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, nodes };
}

export function withEdges(snapshot: UnknownRecord, edges: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, edges };
}

/**
 * Creates a condition bound to a node and returns the updated snapshot: it appends
 * the condition to `conditions` and sets the node's `config.conditionCode`. Lets the
 * user turn an empty CONDITION node into an editable rule by picking an input var.
 */
export function withNewNodeCondition(
  snapshot: UnknownRecord,
  nodeKey: string,
  variableCode: string,
): UnknownRecord {
  const code = `${nodeKey}_COND`.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const nodes = asRows(snapshot.nodes).map((node) =>
    display(node, 'key') === nodeKey
      ? { ...node, config: { ...asRecord(node.config), conditionCode: code } }
      : node,
  );
  const label = display(
    asRows(snapshot.nodes).find((node) => display(node, 'key') === nodeKey) ?? {},
    'label',
    'key',
  );
  const condition = {
    code,
    name: `Condición de ${label}`,
    expressionType: 'JSON_AST',
    expression: { variable: variableCode, operator: 'gte', value: 0 },
    severity: 'BLOCKING',
  };
  return { ...snapshot, nodes, conditions: [...asRows(snapshot.conditions), condition] };
}
