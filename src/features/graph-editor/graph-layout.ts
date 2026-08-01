import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/** Separación por defecto entre columnas y entre filas, en % del mundo del lienzo
 *  (ver WORLD_WIDTH/WORLD_HEIGHT en GraphCanvas): ~235 px y ~133 px. */
const COLUMN_PITCH = 14;
const ROW_PITCH = 13;

/**
 * Layout determinista de izquierda a derecha para grafos de decisión.
 *
 * Antes el nivel de cada nodo se fijaba con un BFS: el primer camino que lo
 * alcanzaba ganaba, así que un nodo con varios predecesores a distinta
 * profundidad quedaba en la columna del predecesor más cercano y sus aristas
 * apuntaban "hacia atrás", desordenando los grafos ya hechos al re-acomodarlos.
 *
 * Ahora se usa layering por **camino más largo** (estilo Sugiyama): cada nodo
 * queda a la derecha de TODOS sus predecesores, así ninguna arista retrocede.
 * Luego un par de barridas por **baricentro** ordenan las filas de cada columna
 * según la posición media de sus vecinos, reduciendo cruces y alineando el flujo.
 */
/**
 * The canvas positions nodes as percentages (0–100). Re-layout a graph only when
 * its coordinates fall OUTSIDE that space — e.g. the seeder writes pixel-based
 * `xPos = order*120`, and imported/legacy graphs may too, which would clamp every
 * node into one corner and render nothing. Percentage graphs pass through
 * untouched (same array reference) so user-placed positions are preserved.
 */
export function normalizeNodePositions(
  nodes: UnknownRecord[],
  edges: UnknownRecord[],
): UnknownRecord[] {
  if (!nodes.length) return nodes;
  const outOfRange = nodes.some((node) => {
    const x = typeof node.x === 'number' ? node.x : 0;
    const y = typeof node.y === 'number' ? node.y : 0;
    return x > 100 || x < 0 || y > 100 || y < 0;
  });
  return outOfRange ? layoutGraphNodes(nodes, edges) : nodes;
}

/**
 * A loaded CONDITION node carries its condition in the `conditions[].code` binding
 * (backend shape), but the editor and edge logic read `config.conditionCode`. Copy
 * it across so clicking a loaded condition node shows its condition instead of "no
 * tiene una condición asociada", and edges can still branch from it.
 */
function withConditionCode(node: UnknownRecord): UnknownRecord {
  if (node.type !== 'CONDITION') return node;
  const config = asRecord(node.config);
  if (config.conditionCode) return node;
  const bound = asRows(node.conditions)[0];
  const code = bound ? display(bound, 'code', 'conditionCode') : '';
  if (!code || code === '—') return node;
  return { ...node, config: { ...config, conditionCode: code } };
}

/**
 * Normalises a freshly loaded graph so the editor can render it: re-layouts nodes
 * whose coordinates are outside the canvas space (seeded/imported pixel graphs) and
 * back-fills each CONDITION node's `config.conditionCode` from its binding.
 */
export function normalizeLoadedGraph(graph: UnknownRecord): UnknownRecord {
  const nodes = asRows(graph.nodes);
  if (!nodes.length) return graph;
  const laid = normalizeNodePositions(nodes, asRows(graph.edges));
  const normalized = laid.map(withConditionCode);
  const unchanged = laid === nodes && normalized.every((node, index) => node === nodes[index]);
  return unchanged ? graph : { ...graph, nodes: normalized };
}

export function layoutGraphNodes(nodes: UnknownRecord[], edges: UnknownRecord[]): UnknownRecord[] {
  if (!nodes.length) return nodes;

  const keys = nodes.map((node) => display(node, 'key'));
  const keySet = new Set(keys);
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const key of keys) {
    incoming.set(key, []);
    outgoing.set(key, []);
  }
  for (const edge of edges) {
    const from = display(edge, 'from');
    const to = display(edge, 'to');
    if (!keySet.has(from) || !keySet.has(to) || from === to) continue;
    outgoing.get(from)!.push(to);
    incoming.get(to)!.push(from);
  }

  const levels = longestPathLevels(nodes, keys, incoming, outgoing);
  const columns = groupByLevel(keys, levels);
  orderRowsByBarycentre(columns, levels, incoming, outgoing);

  const maxLevel = Math.max(0, ...columns.keys());
  const rowOf = new Map<string, { row: number; size: number }>();
  for (const column of columns.values()) {
    column.forEach((key, row) => rowOf.set(key, { row, size: column.length }));
  }

  const maxRows = Math.max(1, ...[...columns.values()].map((column) => column.length));
  // El lienzo es un "mundo" de ~1680x1020 px y estas coordenadas son porcentajes
  // suyos: se usa un paso fijo (que sólo se comprime cuando el grafo es muy
  // profundo o muy ancho) para que las tarjetas nunca se solapen y el usuario
  // recorra el flujo con el scroll en vez de verlo apelmazado.
  const columnPitch = maxLevel ? Math.min(COLUMN_PITCH, 84 / maxLevel) : 0;
  const rowPitch = maxRows > 1 ? Math.min(ROW_PITCH, 80 / (maxRows - 1)) : 0;

  return nodes.map((node) => {
    const key = display(node, 'key');
    const level = levels.get(key) ?? 0;
    const placement = rowOf.get(key) ?? { row: 0, size: 1 };
    const x = maxLevel ? 4 + level * columnPitch : 38;
    // Cada columna se centra verticalmente respecto de la más poblada.
    const columnHeight = (placement.size - 1) * rowPitch;
    const y = 8 + ((maxRows - 1) * rowPitch - columnHeight) / 2 + placement.row * rowPitch;
    return { ...node, x: +x.toFixed(2), y: +y.toFixed(2) };
  });
}

/**
 * Nivel = 1 + máximo nivel de los predecesores (0 para raíces). Se resuelve en
 * orden topológico (Kahn); los nodos que queden en un ciclo caen en una última
 * columna para no perderlos ni colgar el algoritmo.
 */
function longestPathLevels(
  nodes: UnknownRecord[],
  keys: string[],
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
): Map<string, number> {
  const startKey = display(nodes.find((node) => node.type === 'START') ?? {}, 'key');
  const indegree = new Map(keys.map((key) => [key, incoming.get(key)!.length]));
  const levels = new Map<string, number>();
  const queue = keys.filter((key) => key === startKey || indegree.get(key) === 0);
  for (const key of queue) levels.set(key, 0);

  while (queue.length) {
    const key = queue.shift()!;
    const base = levels.get(key) ?? 0;
    for (const next of outgoing.get(key)!) {
      levels.set(next, Math.max(levels.get(next) ?? 0, base + 1));
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if ((indegree.get(next) ?? 0) <= 0 && !queue.includes(next)) queue.push(next);
    }
  }

  const connectedMax = Math.max(0, ...levels.values());
  for (const key of keys) if (!levels.has(key)) levels.set(key, connectedMax + 1);
  return levels;
}

function groupByLevel(keys: string[], levels: Map<string, number>): Map<number, string[]> {
  const columns = new Map<number, string[]>();
  for (const key of keys) {
    const level = levels.get(key) ?? 0;
    columns.set(level, [...(columns.get(level) ?? []), key]);
  }
  return columns;
}

/**
 * Dos barridas (adelante y atrás) que ordenan cada columna por la fila media de
 * sus vecinos ya colocados. Es la heurística de baricentro clásica para bajar el
 * número de cruces sin volver el layout no determinista (empates: orden estable).
 */
function orderRowsByBarycentre(
  columns: Map<number, string[]>,
  levels: Map<string, number>,
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
): void {
  const sortedLevels = [...columns.keys()].sort((a, b) => a - b);
  const rowIndex = new Map<string, number>();
  const reindex = () => {
    for (const level of sortedLevels) {
      columns.get(level)!.forEach((key, row) => rowIndex.set(key, row));
    }
  };
  reindex();

  const sweep = (order: number[], neighbours: Map<string, string[]>) => {
    for (const level of order) {
      const column = columns.get(level)!;
      const barycentre = new Map<string, number>();
      column.forEach((key, row) => {
        const rows = neighbours
          .get(key)!
          .filter((other) => levels.get(other) !== level)
          .map((other) => rowIndex.get(other) ?? 0);
        barycentre.set(key, rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : row);
      });
      column.sort((a, b) => barycentre.get(a)! - barycentre.get(b)! || 0);
      reindex();
    }
  };

  sweep(sortedLevels, incoming);
  sweep([...sortedLevels].reverse(), outgoing);
}
