import { asRecord, display, type UnknownRecord } from '../../utils/records';
import { updateSiblingEdge } from './graph-edge-update';
import { withEdges } from './graph-snapshot';

interface EdgePatchInput {
  snapshot: UnknownRecord;
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  selectedEdgeKey: string;
  patch: UnknownRecord;
}

/**
 * Aplica un cambio a la arista seleccionada y devuelve el snapshot resultante, o `null`
 * si el cambio dejaría el grafo sin salida válida en ese nodo.
 *
 * Vive fuera del hook porque es una regla del grafo, no estado de React: aquí se puede
 * probar sin montar el editor, y el hook queda dentro del límite de tamaño del repo.
 */
export function applyEdgePatch({
  snapshot,
  nodes,
  edges,
  selectedEdgeKey,
  patch,
}: EdgePatchInput): UnknownRecord | null {
  if (!selectedEdgeKey) return null;
  const current = edges.find((edge) => display(edge, 'key') === selectedEdgeKey);
  if (!current) return null;

  const sourceKey = display(current, 'from');
  const siblings = edges.filter(
    (edge) => display(edge, 'from') === sourceKey && display(edge, 'key') !== selectedEdgeKey,
  );
  // Quitar la marca de «por defecto» a la única salida dejaría el nodo sin ruta segura.
  if (patch.default === false && current.default && !siblings.length) return null;

  const source = nodes.find((node) => display(node, 'key') === sourceKey);
  const sourceConditionCode = String(asRecord(source?.config).conditionCode ?? '');
  // Dos salidas por defecto solo tienen sentido si una condición decide entre ellas.
  if (patch.default === true && siblings.some((edge) => edge.default) && !sourceConditionCode) {
    return null;
  }

  return withEdges(
    snapshot,
    edges.map((edge) =>
      updateSiblingEdge({
        edge,
        current,
        patch,
        selectedEdgeKey,
        sourceKey,
        sourceConditionCode,
        firstSibling: siblings[0],
      }),
    ),
  );
}
