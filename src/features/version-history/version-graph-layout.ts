/**
 * Layout tipo GitKraken para el historial de versiones de un artefacto.
 *
 * Cada versión tiene a lo sumo un padre (`sourceVersionId`, la versión de la que
 * se clonó), así que el historial es un árbol. Se empaquetan las versiones en
 * "carriles" (lanes) igual que un grafo de git: una versión hereda el carril de
 * su hijo cuando es su continuación directa, y las ramas abren un carril nuevo.
 *
 * La entrada debe venir ordenada de la más nueva a la más vieja (fila 0 arriba).
 */
export interface VersionInput {
  id: string;
  parentId: string | null;
}

export interface PlacedVersion {
  id: string;
  row: number;
  lane: number;
  parentId: string | null;
}

export interface VersionEdge {
  from: string;
  to: string;
  fromLane: number;
  fromRow: number;
  toLane: number;
  toRow: number;
}

export interface VersionGraphLayout {
  nodes: PlacedVersion[];
  edges: VersionEdge[];
  laneCount: number;
}

export function layoutVersionGraph(versions: VersionInput[]): VersionGraphLayout {
  // `lanes[i]` guarda el id de la versión que "espera" ocupar ese carril (su
  // hijo ya fue colocado y reservó el carril para el padre). null = carril libre.
  const lanes: (string | null)[] = [];
  const placed: PlacedVersion[] = [];

  versions.forEach((version, row) => {
    let lane = lanes.indexOf(version.id);
    if (lane === -1) {
      const free = lanes.indexOf(null);
      lane = free === -1 ? lanes.length : free;
    } else {
      // Varios hijos apuntando a este mismo padre: se queda con el carril más a
      // la izquierda y libera los demás (ahí terminan sus ramas).
      for (let i = 0; i < lanes.length; i += 1) {
        if (i !== lane && lanes[i] === version.id) lanes[i] = null;
      }
    }
    lanes[lane] = version.parentId ?? null;
    placed.push({ id: version.id, row, lane, parentId: version.parentId ?? null });
  });

  const laneCount = placed.reduce((max, node) => Math.max(max, node.lane + 1), 1);
  const byId = new Map(placed.map((node) => [node.id, node]));
  const edges: VersionEdge[] = [];
  for (const node of placed) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (!parent) continue;
    edges.push({
      from: node.id,
      to: parent.id,
      fromLane: node.lane,
      fromRow: node.row,
      toLane: parent.lane,
      toRow: parent.row,
    });
  }

  return { nodes: placed, edges, laneCount };
}
