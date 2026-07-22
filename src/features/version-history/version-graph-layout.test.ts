import { layoutVersionGraph } from './version-graph-layout';

describe('layoutVersionGraph', () => {
  it('mantiene la troncal en un carril y abre uno nuevo para la rama', () => {
    // v2 y v3 se clonaron ambas de v1. Entrada de la más nueva a la más vieja.
    const layout = layoutVersionGraph([
      { id: 'v3', parentId: 'v1' },
      { id: 'v2', parentId: 'v1' },
      { id: 'v1', parentId: null },
    ]);
    const lane = new Map(layout.nodes.map((node) => [node.id, node.lane]));

    expect(layout.laneCount).toBe(2);
    // La troncal (v3 → v1) se queda en el carril 0; v2 abre el carril 1.
    expect(lane.get('v1')).toBe(0);
    expect(lane.get('v3')).toBe(0);
    expect(lane.get('v2')).toBe(1);
    // Dos aristas hijo→padre, ambas apuntando a v1.
    expect(layout.edges.map((edge) => `${edge.from}->${edge.to}`).sort()).toEqual([
      'v2->v1',
      'v3->v1',
    ]);
  });

  it('una historia lineal usa un solo carril', () => {
    const layout = layoutVersionGraph([
      { id: 'v3', parentId: 'v2' },
      { id: 'v2', parentId: 'v1' },
      { id: 'v1', parentId: null },
    ]);

    expect(layout.laneCount).toBe(1);
    expect(layout.nodes.every((node) => node.lane === 0)).toBe(true);
    expect(layout.edges).toHaveLength(2);
  });
});
