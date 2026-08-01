import { describe, expect, it } from 'vitest';
import { astToText, astVariables, shortVariable } from './json-ast';
import { nodeIo } from './node-io';

/**
 * Árboles copiados de una respuesta real de `/v1/artifact-versions/:id/graph`
 * del motor en desarrollo. Son la forma que el editor no sabía leer y que hacía
 * que todos los nodos dijeran "no lee ninguna variable".
 */
const CONDITION_AST = {
  op: 'or',
  args: [
    { op: 'lte', left: { var: 'disposable_income' }, right: { value: 0 } },
    { op: 'lt', left: { var: 'decision.output.affordability_score' }, right: { value: 40 } },
  ],
};

const ACTION_AST = {
  field: 'identity_verification_score',
  valueExpression: {
    op: 'round',
    arg: {
      op: 'add',
      args: [
        { op: 'mul', args: [{ var: 'identity_confidence_score' }, { value: 0.3 }] },
        { op: 'mul', args: [{ var: 'biometric_match_score' }, { value: 0.2 }] },
      ],
    },
    precision: 0,
  },
};

describe('astVariables', () => {
  it('recorre el árbol completo y recoge todas las variables', () => {
    expect(astVariables(CONDITION_AST)).toEqual([
      'disposable_income',
      'decision.output.affordability_score',
    ]);
  });

  it('encuentra las variables anidadas dentro de una acción', () => {
    expect(astVariables(ACTION_AST)).toEqual([
      'identity_confidence_score',
      'biometric_match_score',
    ]);
  });

  it('no repite una variable usada varias veces', () => {
    const tree = { op: 'and', args: [{ var: 'edad' }, { op: 'gt', left: { var: 'edad' } }] };
    expect(astVariables(tree)).toEqual(['edad']);
  });

  it('devuelve vacío ante un árbol sin variables o ausente', () => {
    expect(astVariables({ value: 5 })).toEqual([]);
    expect(astVariables(null)).toEqual([]);
  });
});

describe('shortVariable', () => {
  it('acorta la ruta a lo que el usuario reconoce', () => {
    expect(shortVariable('decision.output.affordability_score')).toBe('affordability_score');
    expect(shortVariable('edad')).toBe('edad');
  });
});

describe('astToText', () => {
  it('traduce una comparación a texto legible', () => {
    expect(astToText({ op: 'gte', left: { var: 'score_buro' }, right: { value: 700 } })).toBe(
      'score_buro ≥ 700',
    );
  });

  it('une las ramas de un or con lenguaje natural', () => {
    expect(astToText(CONDITION_AST)).toBe('disposable_income ≤ 0 o affordability_score < 40');
  });

  it('lee una negación y un condicional', () => {
    expect(astToText({ op: 'not', arg: { var: 'consent_active' } })).toBe('no consent_active');
    expect(
      astToText({
        op: 'if',
        condition: { var: 'pep_status' },
        then: { value: 'REVIEW' },
        else: { value: 'PASS' },
      }),
    ).toBe('si pep_status → REVIEW, si no → PASS');
  });

  it('corta a lo ancho en lugar de escupir un árbol ilegible', () => {
    const deep = { op: 'and', args: [{ op: 'or', args: [{ op: 'not', arg: CONDITION_AST }] }] };
    expect(astToText(deep)).toContain('…');
  });
});

describe('nodeIo con datos reales del motor', () => {
  const CONDITIONS = [{ code: 'COND_AFF', expression: CONDITION_AST }];
  const ACTIONS = [
    { code: 'SET_IDENTITY', type: 'SET_FIELD', payload: ACTION_AST, reasonCodes: [] },
    {
      code: 'EMIT_KYC_INVALID',
      type: 'EMIT_REASON',
      payload: {},
      reasonCodes: [{ code: 'KYC_INVALID' }],
    },
  ];

  it('el inicio recibe las variables de entrada declaradas, no "ninguna"', () => {
    const io = nodeIo(
      { type: 'START' },
      {
        variables: [
          { code: 'kyc_status', usageType: 'INPUT' },
          { code: 'age', usageType: 'INPUT' },
          { code: 'decision', usageType: 'OUTPUT_PRIMARY' },
        ],
      },
    );

    expect(io.reads).toEqual(['kyc_status', 'age']);
    expect(io.action).toContain('2 variables de entrada');
  });

  it('una condición del motor declara las variables de su árbol', () => {
    const io = nodeIo(
      { type: 'CONDITION', conditions: [{ code: 'COND_AFF' }] },
      { conditions: CONDITIONS },
    );

    expect(io.reads).toEqual(['disposable_income', 'affordability_score']);
  });

  it('un nodo de acción lee de la expresión y escribe el campo destino', () => {
    const io = nodeIo(
      { type: 'ACTION', actions: [{ code: 'SET_IDENTITY', order: 1 }] },
      { actions: ACTIONS },
    );

    expect(io.reads).toEqual(['identity_confidence_score', 'biometric_match_score']);
    expect(io.writes).toEqual(['identity_verification_score']);
    expect(io.action).toContain('calcula y escribe un valor: identity_verification_score');
  });

  it('un nodo con varias acciones las nombra en su orden de ejecución', () => {
    const io = nodeIo(
      {
        type: 'ACTION',
        actions: [
          { code: 'SET_IDENTITY', order: 1 },
          { code: 'EMIT_KYC_INVALID', order: 2 },
        ],
      },
      { actions: ACTIONS },
    );

    expect(io.action).toContain('SET_IDENTITY → EMIT_KYC_INVALID');
    expect(io.writes).toContain('KYC_INVALID');
  });
});
