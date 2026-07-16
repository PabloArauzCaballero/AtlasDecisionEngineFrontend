import { createEdgeDraft, createNodeDraft } from './graph-authoring';

describe('visual graph authoring', () => {
  const input = {
    code: 'score',
    dataType: 'INTEGER',
    usageType: 'INPUT',
  };

  it('creates a CONDITION node and its canonical graph condition together', () => {
    const draft = createNodeDraft('CONDITION', [], [input], { x: 20, y: 30 });

    expect(draft.node).toEqual(
      expect.objectContaining({
        key: 'CONDITION_1',
        type: 'CONDITION',
        order: 1,
        config: { conditionCode: 'CONDITION_1_EXPR' },
      }),
    );
    expect(draft.condition).toEqual(
      expect.objectContaining({
        code: 'CONDITION_1_EXPR',
        expressionType: 'JSON_AST',
        expression: { variable: 'score', operator: 'gte', value: 0 },
      }),
    );
  });

  it('builds one default branch and then a valid conditional branch', () => {
    const conditionDraft = createNodeDraft('CONDITION', [], [input]);
    const nodes = [
      conditionDraft.node,
      createNodeDraft('RESULT', [conditionDraft.node], [input]).node,
      createNodeDraft('END', [conditionDraft.node], [input]).node,
    ];
    const conditions = [conditionDraft.condition!];
    const fallback = createEdgeDraft('CONDITION_1', 'RESULT_1', nodes, [], conditions)!;
    const matched = createEdgeDraft('CONDITION_1', 'END_1', nodes, [fallback], conditions)!;

    expect(fallback).toEqual(expect.objectContaining({ default: true, conditions: [] }));
    expect(matched).toEqual(
      expect.objectContaining({
        default: false,
        type: 'CONDITIONAL',
        conditions: [{ code: 'CONDITION_1_EXPR', order: 1 }],
      }),
    );
  });

  it('does not create outgoing edges from terminal RESULT nodes', () => {
    const result = createNodeDraft('RESULT', [], [input]).node;
    const end = createNodeDraft('END', [result], [input]).node;
    expect(createEdgeDraft('RESULT_1', 'END_1', [result, end], [], [])).toBeNull();
  });

  it('keeps visual condition nodes binary and prevents ambiguous extra branches', () => {
    const conditionDraft = createNodeDraft('CONDITION', [], [input]);
    const result = createNodeDraft('RESULT', [conditionDraft.node], [input]).node;
    const end = createNodeDraft('END', [conditionDraft.node, result], [input]).node;
    const review = createNodeDraft(
      'MANUAL_REVIEW',
      [conditionDraft.node, result, end],
      [input],
    ).node;
    const nodes = [conditionDraft.node, result, end, review];
    const conditions = [conditionDraft.condition!];
    const first = createEdgeDraft('CONDITION_1', 'RESULT_1', nodes, [], conditions)!;
    const second = createEdgeDraft('CONDITION_1', 'END_1', nodes, [first], conditions)!;

    expect(
      createEdgeDraft('CONDITION_1', 'MANUAL_REVIEW_1', nodes, [first, second], conditions),
    ).toBeNull();
  });
});
