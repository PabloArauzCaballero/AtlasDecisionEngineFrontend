import { layoutGraphNodes } from './graph-layout';

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
});
