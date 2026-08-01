import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

export function withNodes(snapshot: UnknownRecord, nodes: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, nodes };
}

export function withEdges(snapshot: UnknownRecord, edges: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, edges };
}

/** Códigos de condición que un nodo usa, por configuración o por enlace. */
function conditionCodesOfNode(node: UnknownRecord): string[] {
  const fromConfig = display(asRecord(node.config), 'conditionCode');
  const fromBindings = asRows(node.conditions).map((binding) => display(binding, 'code'));
  return [fromConfig, ...fromBindings].filter(Boolean);
}

/** Códigos de condición que usa una arista. */
function conditionCodesOfEdge(edge: UnknownRecord): string[] {
  return asRows(edge.conditions)
    .map((binding) => display(binding, 'code'))
    .filter(Boolean);
}

/**
 * Borra un nodo y todo lo que dejaba de tener sentido con él.
 *
 * Quitar sólo el nodo y sus aristas deja basura detrás: la condición que se creó
 * para ese nodo sigue en `conditions`, y el campo del contrato de salida sigue
 * apuntando a un nodo que ya no existe. Ambos viajan al backend en el siguiente
 * guardado —el adaptador los manda tal cual—, así que la versión archivada del
 * artefacto acabaría describiendo un grafo que no es el que se ve. En algo que
 * se audita, eso importa más que el desorden.
 *
 * Una condición sólo se borra si NADIE más la usa: son reutilizables, y llevarse
 * por delante la de otro nodo sería mucho peor que dejar una de sobra.
 */
export function withoutNode(snapshot: UnknownRecord, nodeKey: string): UnknownRecord {
  const nodes = asRows(snapshot.nodes);
  const edges = asRows(snapshot.edges);
  const removedNode = nodes.find((node) => display(node, 'key') === nodeKey);
  if (!removedNode) return snapshot;

  const remainingNodes = nodes.filter((node) => display(node, 'key') !== nodeKey);
  const remainingEdges = edges.filter(
    (edge) => display(edge, 'from') !== nodeKey && display(edge, 'to') !== nodeKey,
  );

  const stillUsed = new Set([
    ...remainingNodes.flatMap(conditionCodesOfNode),
    ...remainingEdges.flatMap(conditionCodesOfEdge),
  ]);
  const orphaned = new Set(
    [
      ...conditionCodesOfNode(removedNode),
      ...edges.filter((edge) => !remainingEdges.includes(edge)).flatMap(conditionCodesOfEdge),
    ].filter((code) => !stillUsed.has(code)),
  );

  return {
    ...snapshot,
    nodes: remainingNodes,
    edges: remainingEdges,
    conditions: asRows(snapshot.conditions).filter(
      (condition) => !orphaned.has(display(condition, 'code')),
    ),
    // Un campo publicado que salía de este nodo se queda sin origen. Se conserva
    // la fila pero se vacía la referencia, para que el hueco se vea en el panel
    // en lugar de desaparecer sin que nadie se entere de que falta.
    outputContract: asRows(snapshot.outputContract).map((field) =>
      display(field, 'sourceKind') === 'NODE' && display(field, 'sourceRef') === nodeKey
        ? { ...field, sourceRef: '' }
        : field,
    ),
  };
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
