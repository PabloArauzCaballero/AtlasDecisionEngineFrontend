import { describe, expect, it } from 'vitest';
import { toActionBank, type VersionGraph } from './action-bank';
import { matchImportToBank, pendingLiterals, reusableFromImport } from './import-bank-match';

/**
 * Nodos tal como los devuelve `/v1/code-imports`: cada rama es un RESULT con
 * asignaciones literales, sin ninguna acción. Copiado de una respuesta real.
 */
const IMPORT_NODES = [
  { key: 'START', type: 'START', label: 'Inicio', config: {} },
  { key: 'CHECK_1', type: 'CONDITION', label: 'variables.edad < 18', config: {} },
  {
    key: 'RESULT_1',
    type: 'RESULT',
    label: 'Resultado: RECHAZADO',
    config: {
      mode: 'MAPPING',
      assignments: [
        { outputCode: 'decision', source: 'LITERAL', value: 'RECHAZADO' },
        { outputCode: 'motivo', source: 'LITERAL', value: 'AGE_NOT_ELIGIBLE' },
        { outputCode: 'limite', source: 'EXPRESSION', expression: { var: 'ingreso_mensual' } },
      ],
    },
  },
];

const BANK = toActionBank([
  {
    versionId: '592',
    artifactCode: 'BNPL_CREDIT_DECISION',
    artifactName: 'BNPL',
    semanticVersion: '2.0.0',
    status: 'DEPLOYED_TO_PROD',
    actions: [
      {
        code: 'EMIT_ELIG_AGE',
        type: 'EMIT_REASON',
        terminal: true,
        payload: {},
        reasonCodes: [{ code: 'AGE_NOT_ELIGIBLE' }],
      },
      {
        code: 'SET_LIMITE',
        type: 'SET_FIELD',
        terminal: false,
        payload: { field: 'limite', valueExpression: { var: 'ingreso_mensual' } },
        reasonCodes: [],
      },
    ],
    nodes: [],
  } satisfies VersionGraph,
]);

describe('matchImportToBank', () => {
  const matches = matchImportToBank(IMPORT_NODES, BANK);

  it('sólo mira los nodos de resultado, que son los que escriben', () => {
    expect(matches).toHaveLength(3);
    expect(matches.every((entry) => entry.node === 'Resultado: RECHAZADO')).toBe(true);
  });

  it('reconoce un motivo escrito como literal y lo une a la acción que lo emite', () => {
    const motivo = matches.find((entry) => entry.outputCode === 'motivo');

    expect(motivo?.match).toEqual({
      code: 'EMIT_ELIG_AGE',
      implies: expect.stringContaining('emite un motivo explicable'),
      kind: 'motivo',
    });
  });

  it('une por campo destino cuando no hay motivo que coincida', () => {
    const limite = matches.find((entry) => entry.outputCode === 'limite');

    expect(limite?.match?.code).toBe('SET_LIMITE');
    expect(limite?.match?.kind).toBe('campo');
    // Lo calcula una expresión, así que no hay literal que enseñar.
    expect(limite?.value).toBe('');
  });

  it('deja sin pareja lo que el banco no sabe hacer', () => {
    expect(matches.find((entry) => entry.outputCode === 'decision')?.match).toBeUndefined();
  });

  it('no se rompe con un banco vacío', () => {
    expect(matchImportToBank(IMPORT_NODES, []).every((entry) => !entry.match)).toBe(true);
  });
});

describe('reusableFromImport', () => {
  it('propone cada acción una sola vez aunque varias ramas la repitan', () => {
    const twice = [...IMPORT_NODES, { ...IMPORT_NODES[2], key: 'RESULT_2' }];

    expect(reusableFromImport(matchImportToBank(twice, BANK)).map((entry) => entry.match?.code)) //
      .toEqual(['EMIT_ELIG_AGE', 'SET_LIMITE']);
  });
});

describe('pendingLiterals', () => {
  /** Una rama del ejemplo real: motivo emitido + dos salidas normales. */
  const NODES = [
    {
      key: 'RESULT_1',
      type: 'RESULT',
      label: 'Resultado: RECHAZADO',
      config: {
        mode: 'MAPPING',
        assignments: [
          { outputCode: 'decision', source: 'LITERAL', value: 'RECHAZADO' },
          { outputCode: 'motivo', source: 'LITERAL', value: 'AGE_NOT_ELIGIBLE' },
          { outputCode: 'limite', source: 'LITERAL', value: 0 },
        ],
      },
    },
  ];
  const assignments = matchImportToBank(NODES, BANK);

  it('no queda nada pendiente cuando el motor ya emite el motivo', () => {
    // `decision` y `limite` son valores normales del resultado, no motivos:
    // señalarlos hacía que el panel pidiera declararlos en el banco justo debajo
    // de decir que ya estaba todo emitido.
    expect(pendingLiterals(assignments, ['AGE_NOT_ELIGIBLE'])).toEqual([]);
  });

  it('señala un motivo que el motor NO supo emitir', () => {
    const otra = [
      {
        ...NODES[0],
        key: 'RESULT_2',
        config: {
          mode: 'MAPPING',
          assignments: [
            { outputCode: 'decision', source: 'LITERAL', value: 'REVISION' },
            { outputCode: 'motivo', source: 'LITERAL', value: 'MOTIVO_SIN_DECLARAR' },
          ],
        },
      },
    ];
    const pending = pendingLiterals(matchImportToBank([...NODES, ...otra], BANK), [
      'AGE_NOT_ELIGIBLE',
    ]);

    expect(pending.map((entry) => entry.value)).toEqual(['MOTIVO_SIN_DECLARAR']);
  });

  it('sin ninguna acción emitida avisa de todo: no hay pista de cuál es el motivo', () => {
    expect(pendingLiterals(assignments, [])).toHaveLength(3);
  });
});
