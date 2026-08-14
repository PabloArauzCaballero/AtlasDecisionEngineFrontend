import { describe, expect, it } from 'vitest';
import { buildCoverageMatrix, policyScopes } from './coverage-matrix';

const OBJECTIVES = [
  { id: '1', policyRequirements: [{ policyCode: 'POL_A' }] },
  { id: '2', policyRequirements: [{ policyCode: 'POL_B' }] },
];

const PAYLOAD = {
  policies: [
    { id: '10', policyCode: 'POL_A' },
    { id: '20', policyCode: 'POL_B' },
  ],
  objectives: [
    { id: '1', objectiveCode: 'OBJ_A', name: 'A', coverage: { POL_A: 'COMPLETE', POL_B: 'GAP' } },
    { id: '2', objectiveCode: 'OBJ_B', name: 'B', coverage: { POL_A: 'GAP', POL_B: 'GAP' } },
  ],
  covered: 1,
  total: 4,
};

describe('buildCoverageMatrix', () => {
  it('sólo cuenta los cruces que son un requisito del objetivo', () => {
    const matrix = buildCoverageMatrix(PAYLOAD, policyScopes(OBJECTIVES));

    expect(matrix.scoped).toBe(true);
    // El motor dice 1/4 = 25 %; las otras dos celdas no existen como requisito.
    expect(matrix.required).toBe(2);
    expect(matrix.complete).toBe(1);
    expect(matrix.gaps).toBe(1);
    expect(matrix.pct).toBe(50);
  });

  it('marca como NOT_APPLICABLE la política de otro objetivo', () => {
    const matrix = buildCoverageMatrix(PAYLOAD, policyScopes(OBJECTIVES));

    expect(matrix.rows[0]?.cells).toEqual(['COMPLETE', 'NOT_APPLICABLE']);
    expect(matrix.rows[1]?.cells).toEqual(['NOT_APPLICABLE', 'GAP']);
  });

  it('respeta el NOT_APPLICABLE que ya manda el motor, sin alcance derivado', () => {
    const payload = {
      policies: [
        { id: '10', policyCode: 'POL_A' },
        { id: '20', policyCode: 'POL_B' },
      ],
      objectives: [
        {
          id: '1',
          objectiveCode: 'OBJ_A',
          name: 'A',
          coverage: { POL_A: 'COMPLETE', POL_B: 'NOT_APPLICABLE' },
        },
      ],
    };

    const matrix = buildCoverageMatrix(payload, null);

    // Sin alcance derivado el porcentaje sigue saliendo bien, porque el motor ya
    // distingue la celda que no existe: 1 de 1, no 1 de 2.
    expect(matrix.required).toBe(1);
    expect(matrix.pct).toBe(100);
  });

  it('descarta un alcance incompleto en vez de esconder huecos reales', () => {
    const matrix = buildCoverageMatrix(PAYLOAD, policyScopes(OBJECTIVES.slice(0, 1)));

    expect(matrix.scoped).toBe(false);
    expect(matrix.required).toBe(4);
    expect(matrix.gaps).toBe(3);
    expect(matrix.pct).toBe(25);
  });

  it('sin alcance cuenta la rejilla entera, como hacía el motor', () => {
    const matrix = buildCoverageMatrix(PAYLOAD, null);

    expect(matrix.scoped).toBe(false);
    expect(matrix.required).toBe(4);
    expect(matrix.pct).toBe(25);
  });

  it('un estado que el motor no declara se lee como hueco, no como cubierto', () => {
    const payload = {
      policies: [{ id: '10', policyCode: 'POL_A' }],
      objectives: [{ id: '1', objectiveCode: 'OBJ_A', name: 'A', coverage: { POL_A: 'RARO' } }],
    };

    const matrix = buildCoverageMatrix(payload, policyScopes([OBJECTIVES[0]!]));

    expect(matrix.rows[0]?.cells).toEqual(['GAP']);
    expect(matrix.gaps).toBe(1);
  });

  it('una respuesta vacía no divide entre cero', () => {
    const matrix = buildCoverageMatrix(undefined, null);

    expect(matrix.rows).toEqual([]);
    expect(matrix.pct).toBe(0);
  });
});
