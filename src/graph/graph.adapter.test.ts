import { snapshotToEditableGraph } from './graph.adapter';

describe('snapshotToEditableGraph', () => {
  it('preserves dependency metadata returned by the backend', () => {
    const editable = snapshotToEditableGraph({
      variables: [
        {
          variableVersionId: 'variable-1',
          code: 'income',
          usageType: 'INPUT',
          dependencyPath: 'application.income',
          required: true,
          fallbackPolicy: 'FAIL',
        },
      ],
      conditions: [],
      actions: [],
      nodes: [],
      edges: [],
    });
    expect(editable.dependencies).toEqual([
      {
        variableVersionId: 'variable-1',
        usageType: 'INPUT',
        isRequired: true,
        fallbackPolicy: 'FAIL',
        dependencyPath: 'application.income',
      },
    ]);
  });

  it('provides safe defaults for older graph snapshots', () => {
    const editable = snapshotToEditableGraph({
      variables: [
        {
          variableVersionId: 'variable-1',
          code: 'income',
          required: false,
          fallbackPolicy: 'NULL',
        },
      ],
    });
    expect(editable.dependencies).toEqual([
      expect.objectContaining({
        usageType: 'INPUT',
        dependencyPath: 'input.income',
      }),
    ]);
  });

  it('round-trips configurable output dependencies and RESULT node mappings', () => {
    const editable = snapshotToEditableGraph({
      variables: [
        {
          variableVersionId: 'output-version-1',
          code: 'scoring',
          usageType: 'OUTPUT_PRIMARY',
          dependencyPath: 'output.scoring',
          required: true,
          fallbackPolicy: 'FAIL_CLOSED',
        },
      ],
      nodes: [
        {
          key: 'RESULT_1',
          type: 'RESULT',
          label: 'Scoring result',
          terminal: true,
          config: {
            mode: 'MAPPING',
            assignments: [{ outputCode: 'scoring', source: 'LITERAL', value: 700 }],
          },
          conditions: [],
          actions: [],
        },
      ],
    });
    expect(editable.dependencies).toEqual([
      expect.objectContaining({
        variableVersionId: 'output-version-1',
        usageType: 'OUTPUT_PRIMARY',
        dependencyPath: 'output.scoring',
      }),
    ]);
    expect(editable.nodes).toEqual([
      expect.objectContaining({
        type: 'RESULT',
        config: expect.objectContaining({ mode: 'MAPPING' }),
      }),
    ]);
  });

  it('serializes visual edge condition bindings into the backend DTO', () => {
    const editable = snapshotToEditableGraph({
      conditions: [
        {
          code: 'SCORE_OK',
          name: 'Score acceptable',
          expressionType: 'JSON_AST',
          expression: { variable: 'score', operator: 'gte', value: 600 },
          severity: 'BLOCKING',
          reusable: false,
        },
      ],
      edges: [
        {
          key: 'CHECK__APPROVE',
          from: 'CHECK',
          to: 'APPROVE',
          type: 'CONDITIONAL',
          priority: 1,
          default: false,
          conditions: [{ code: 'SCORE_OK', order: 1 }],
        },
      ],
    });

    expect(editable.edges).toEqual([
      expect.objectContaining({
        conditions: [{ conditionCode: 'SCORE_OK', order: 1 }],
      }),
    ]);
  });
});
