import { layoutGraphNodes, normalizeLoadedGraph, normalizeNodePositions } from './graph-layout';
import { asRows, display } from '../../utils/records';

describe('layoutGraphNodes', () => {
  it('orders a decision flow from left to right and separates sibling outcomes', () => {
    const nodes = [
      { key: 'START', type: 'START' },
      { key: 'CHECK', type: 'CONDITION' },
      { key: 'APPROVE', type: 'RESULT' },
      { key: 'REVIEW', type: 'MANUAL_REVIEW' },
    ];
    const edges = [
      { from: 'START', to: 'CHECK' },
      { from: 'CHECK', to: 'APPROVE' },
      { from: 'CHECK', to: 'REVIEW' },
    ];

    const placed = layoutGraphNodes(nodes, edges);
    const byKey = new Map(placed.map((node) => [node.key, node]));

    expect(Number(byKey.get('START')?.x)).toBeLessThan(Number(byKey.get('CHECK')?.x));
    expect(Number(byKey.get('CHECK')?.x)).toBeLessThan(Number(byKey.get('APPROVE')?.x));
    expect(byKey.get('APPROVE')?.y).not.toBe(byKey.get('REVIEW')?.y);
  });

  it('coloca un nodo a la derecha de TODOS sus predecesores (camino más largo)', () => {
    // D depende de START y de B; B también sale de START. Su columna debe ser la
    // del camino más largo (START→B→D), no la del atajo START→D. Con el BFS
    // anterior B y D caían en la misma columna y la arista B→D retrocedía.
    const nodes = [
      { key: 'START', type: 'START' },
      { key: 'B', type: 'CONDITION' },
      { key: 'D', type: 'RESULT' },
    ];
    const edges = [
      { from: 'START', to: 'B' },
      { from: 'START', to: 'D' },
      { from: 'B', to: 'D' },
    ];

    const byKey = new Map(layoutGraphNodes(nodes, edges).map((node) => [node.key, node]));

    expect(Number(byKey.get('B')?.x)).toBeLessThan(Number(byKey.get('D')?.x));
  });
});

describe('normalizeNodePositions', () => {
  const edges = [{ from: 'START', to: 'CHECK' }];

  it('re-layouts pixel-based coordinates (seeder xPos=order*120) into the 0-100 canvas', () => {
    // These would all clamp to the corner (x>100) and render nothing.
    const nodes = [
      { key: 'START', type: 'START', x: 120, y: 100 },
      { key: 'CHECK', type: 'CONDITION', x: 240, y: 100 },
    ];
    const result = normalizeNodePositions(nodes, edges);
    expect(result).not.toBe(nodes); // re-laid
    for (const node of result) {
      expect(Number(node.x)).toBeGreaterThanOrEqual(0);
      expect(Number(node.x)).toBeLessThanOrEqual(100);
      expect(Number(node.y)).toBeLessThanOrEqual(100);
    }
  });

  it('re-acomoda un grafo con todos los nodos apilados en (0,0)', () => {
    // Lo que sirve el motor para un grafo creado por API (sembrado, importado o
    // clonado): coordenadas dentro del rango, pero todas iguales. Sin esto, las
    // tarjetas se pintan una encima de otra en la esquina superior izquierda.
    const nodes = [
      { key: 'START', type: 'START', x: 0, y: 0 },
      { key: 'CHECK', type: 'CONDITION', x: 0, y: 0 },
    ];
    const result = normalizeNodePositions(nodes, edges);

    expect(result).not.toBe(nodes);
    expect(result[0].x).not.toBe(result[1].x);
  });

  it('leaves an already-percentage graph untouched (preserves user positions)', () => {
    const nodes = [
      { key: 'START', type: 'START', x: 10, y: 43 },
      { key: 'CHECK', type: 'CONDITION', x: 40, y: 43 },
    ];
    expect(normalizeNodePositions(nodes, edges)).toBe(nodes);
  });
});

describe('normalizeLoadedGraph (condition binding)', () => {
  it('back-fills config.conditionCode on a loaded CONDITION node from its binding', () => {
    const graph = {
      nodes: [
        { key: 'START', type: 'START', x: 10, y: 43 },
        {
          key: 'CHECK',
          type: 'CONDITION',
          x: 40,
          y: 43,
          config: {},
          conditions: [{ code: 'KYC_OK', expected: true }],
        },
      ],
      edges: [{ from: 'START', to: 'CHECK' }],
    };
    const result = normalizeLoadedGraph(graph);
    const check = asRows(result.nodes).find((node) => display(node, 'key') === 'CHECK');
    const config = (check?.config ?? {}) as Record<string, unknown>;
    expect(config.conditionCode).toBe('KYC_OK');
  });
});
