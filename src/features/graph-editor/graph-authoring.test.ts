import { createEdgeDraft, createNodeDraft, edgeCreationError } from './graph-authoring';

/**
 * Copied from NodeDto/EdgeDto in the Decision Engine. Keys that fail this are
 * rejected with HTTP 400 on `PUT .../graph`, before any graph logic runs.
 */
const BACKEND_KEY_PATTERN = /^[A-Za-z0-9_-]{2,120}$/;

describe('visual graph authoring', () => {
  const input = {
    code: 'score',
    dataType: 'INTEGER',
    usageType: 'INPUT',
  };

  it('generates node and edge keys the backend will accept', () => {
    const start = createNodeDraft('START', [], [input]).node;
    const condition = createNodeDraft('CONDITION', [start], [input]).node;
    const review = createNodeDraft('MANUAL_REVIEW', [start, condition], [input]).node;
    const nodes = [start, condition, review];
    const edges = [
      createEdgeDraft('START', 'CONDITION_1', nodes, [], [])!.edge,
      createEdgeDraft('CONDITION_1', 'MANUAL_REVIEW_1', nodes, [], [])!.edge,
    ];

    expect(nodes.map((node) => node.key)).toEqual(['START', 'CONDITION_1', 'MANUAL_REVIEW_1']);
    expect(edges.map((edge) => edge.key)).toEqual([
      'START__CONDITION_1',
      'CONDITION_1__MANUAL_REVIEW_1',
    ]);

    for (const key of [...nodes, ...edges].map((entry) => entry.key)) {
      expect(key).toEqual(expect.stringMatching(BACKEND_KEY_PATTERN));
    }
  });

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
    const fallback = createEdgeDraft('CONDITION_1', 'RESULT_1', nodes, [], conditions)!.edge;
    const matched = createEdgeDraft('CONDITION_1', 'END_1', nodes, [fallback], conditions)!.edge;

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
    const first = createEdgeDraft('CONDITION_1', 'RESULT_1', nodes, [], conditions)!.edge;
    const second = createEdgeDraft('CONDITION_1', 'END_1', nodes, [first], conditions)!.edge;

    expect(
      createEdgeDraft('CONDITION_1', 'MANUAL_REVIEW_1', nodes, [first, second], conditions),
    ).toBeNull();
  });

  it('prevents connections that would introduce a cycle', () => {
    const start = createNodeDraft('START', [], [input]).node;
    const condition = createNodeDraft('CONDITION', [start], [input]).node;
    const edges = [createEdgeDraft('START', 'CONDITION_1', [start, condition], [], [])!.edge];

    expect(edgeCreationError('CONDITION_1', 'START', [start, condition], edges, [])).toBe(
      'PROHIBITED_CYCLE',
    );
    expect(createEdgeDraft('CONDITION_1', 'START', [start, condition], edges, [])).toBeNull();
  });

  it('explains why invalid connections are rejected', () => {
    const result = createNodeDraft('RESULT', [], [input]).node;

    expect(edgeCreationError('RESULT_1', 'RESULT_1', [result], [], [])).toBe('SAME_NODE');
    expect(edgeCreationError('RESULT_1', 'MISSING', [result], [], [])).toBe('TERMINAL_SOURCE');
  });

  it('creates a SWITCH node that switches on the first input variable', () => {
    const draft = createNodeDraft('SWITCH', [], [input]);
    expect(draft.node).toEqual(
      expect.objectContaining({ key: 'SWITCH_1', type: 'SWITCH', config: { variable: 'score' } }),
    );
    expect(draft.condition).toBeUndefined();
  });

  it('fans a SWITCH out into a default branch plus per-case conditions', () => {
    const switchNode = createNodeDraft('SWITCH', [], [input]).node;
    const a = createNodeDraft('RESULT', [switchNode], [input]).node;
    const b = createNodeDraft('END', [switchNode, a], [input]).node;
    const c = createNodeDraft('MANUAL_REVIEW', [switchNode, a, b], [input]).node;
    const nodes = [switchNode, a, b, c];

    const fallback = createEdgeDraft('SWITCH_1', 'RESULT_1', nodes, [], [])!;
    const caseOne = createEdgeDraft('SWITCH_1', 'END_1', nodes, [fallback.edge], [])!;
    const caseTwo = createEdgeDraft(
      'SWITCH_1',
      'MANUAL_REVIEW_1',
      nodes,
      [fallback.edge, caseOne.edge],
      [],
    )!;

    expect(fallback.edge).toEqual(expect.objectContaining({ default: true, conditions: [] }));
    expect(fallback.condition).toBeUndefined();
    expect(caseOne.edge).toEqual(
      expect.objectContaining({
        default: false,
        type: 'CONDITIONAL',
        conditions: [{ code: 'SWITCH_1_CASE_1', order: 1 }],
      }),
    );
    expect(caseOne.condition).toEqual(
      expect.objectContaining({
        code: 'SWITCH_1_CASE_1',
        expression: { variable: 'score', operator: 'eq', value: '' },
      }),
    );
    expect(caseTwo.edge.conditions).toEqual([{ code: 'SWITCH_1_CASE_2', order: 1 }]);
    expect(caseTwo.edge.key).toEqual(expect.stringMatching(BACKEND_KEY_PATTERN));
    for (const code of ['SWITCH_1_CASE_1', 'SWITCH_1_CASE_2']) {
      expect(code).toEqual(expect.stringMatching(/^[A-Z0-9_-]{2,120}$/));
    }
  });
});
