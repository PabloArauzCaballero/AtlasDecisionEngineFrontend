import { describe, expect, it } from 'vitest';
import { parseContractHeader } from './contract-header';
import {
  allowedValueIssues,
  assignedLiterals,
  declaredVariables,
  locateIn,
  reasonIssues,
  variableIssues,
  type CatalogMatch,
} from './inventory-check';

const SOURCE = [
  '# @atlas-contract',
  '# {',
  '#   "contractVersion": "1",',
  '#   "inputs": [{ "id": "edad", "name": "Edad", "type": "INTEGER", "required": true }],',
  '#   "outputs": [',
  '#     { "id": "decision", "name": "Decision", "type": "STRING", "required": true },',
  '#     { "id": "motivo", "name": "Motivo", "type": "STRING", "required": true }],',
  '#   "primaryOutputId": "decision",',
  '#   "reasonOutputId": "motivo"',
  '# }',
  'edad = variables.get("edad", 0)',
  'if edad < 18:',
  '    result = {"decision": "RECHAZADO", "motivo": "AGE_NOT_ELIGIBLE"}',
  'else:',
  '    result = {"decision": "APROBADO", "motivo": "APPROVED_POLICY"}',
].join('\n');

const locate = locateIn(SOURCE);

const found = (dataType: string): CatalogMatch => ({
  found: { definitionId: '7', name: 'Edad', dataType },
});

describe('parseContractHeader', () => {
  it('lee el contrato del propio código, incluido reasonOutputId', () => {
    const contract = parseContractHeader('PYTHON', SOURCE);

    expect(contract?.reasonOutputId).toBe('motivo');
    expect(contract?.primaryOutputId).toBe('decision');
    expect(contract?.inputs.map((variable) => variable.id)).toEqual(['edad']);
    expect(contract?.outputs.map((variable) => variable.id)).toEqual(['decision', 'motivo']);
  });

  it('no devuelve contrato cuando la marca no está con el comentario del lenguaje', () => {
    // Es justo el caso que hacía fallar un archivo Python analizado como JavaScript.
    expect(parseContractHeader('JAVASCRIPT', SOURCE)).toBeNull();
  });

  it('no inventa nada si el JSON está roto', () => {
    expect(parseContractHeader('PYTHON', '# @atlas-contract\n# { roto\nx = 1')).toBeNull();
  });
});

describe('declaredVariables / assignedLiterals', () => {
  it('lee las variables y los literales del grafo generado', () => {
    const declared = declaredVariables([
      { variableCode: 'edad', usageType: 'INPUT', dataType: 'INTEGER' },
      { variableCode: 'decision', usageType: 'OUTPUT_PRIMARY', dataType: 'STRING' },
    ]);
    expect(declared).toHaveLength(2);
    expect(declared[1].usageType).toBe('OUTPUT_PRIMARY');

    const literals = assignedLiterals([
      { type: 'CONDITION', config: {} },
      {
        type: 'RESULT',
        config: {
          assignments: [
            { outputCode: 'decision', source: 'LITERAL', value: 'RECHAZADO' },
            { outputCode: 'motivo', source: 'LITERAL', value: 'AGE_NOT_ELIGIBLE' },
            { outputCode: 'limite', source: 'EXPRESSION', expression: { var: 'x' } },
          ],
        },
      },
      {
        type: 'RESULT',
        config: { assignments: [{ outputCode: 'decision', value: 'RECHAZADO' }] },
      },
    ]);

    expect(literals.get('decision')).toEqual(['RECHAZADO']);
    expect(literals.get('motivo')).toEqual(['AGE_NOT_ELIGIBLE']);
    expect(literals.has('limite')).toBe(false);
  });
});

describe('variableIssues', () => {
  const declared = declaredVariables([
    { variableCode: 'edad', usageType: 'INPUT', dataType: 'INTEGER' },
  ]);

  it('bloquea una variable que el inventario no tiene', () => {
    const [issue] = variableIssues(declared, new Map([['edad', {}]]), locate);

    expect(issue.code).toBe('CODE_IMPORT_VARIABLE_NOT_IN_CATALOG');
    expect(issue.severity).toBe('ERROR');
    expect(issue.line).toBe(4);
  });

  it('distingue el duplicado por mayúsculas del que no existe', () => {
    const issues = variableIssues(declared, new Map([['edad', { similar: 'EDAD' }]]), locate);

    expect(issues.map((entry) => entry.code)).toEqual([
      'CODE_IMPORT_VARIABLE_NOT_IN_CATALOG',
      'CODE_IMPORT_VARIABLE_CASE_MISMATCH',
    ]);
    expect(issues[1].message).toContain('EDAD');
  });

  it('señala el tipo cuando el contrato y el catálogo no dicen lo mismo', () => {
    const [issue] = variableIssues(declared, new Map([['edad', found('STRING')]]), locate);

    expect(issue.code).toBe('CODE_IMPORT_VARIABLE_TYPE_MISMATCH');
  });

  it('acepta los alias de tipo del catálogo en vez de inventar un desajuste', () => {
    // NUMBER (contrato) y DECIMAL (catálogo) son el mismo tipo.
    const numeric = declaredVariables([
      { variableCode: 'edad', usageType: 'INPUT', dataType: 'NUMBER' },
    ]);
    expect(variableIssues(numeric, new Map([['edad', found('DECIMAL')]]), locate)).toEqual([]);
  });

  it('no opina sobre una variable que todavía no se ha consultado', () => {
    expect(variableIssues(declared, new Map(), locate)).toEqual([]);
  });
});

describe('reasonIssues', () => {
  it('bloquea un motivo que el catálogo no declara', () => {
    const issues = reasonIssues(
      'motivo',
      ['AGE_NOT_ELIGIBLE', 'APPROVED_POLICY'],
      new Map([
        ['AGE_NOT_ELIGIBLE', false],
        ['APPROVED_POLICY', true],
      ]),
      locate,
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('CODE_IMPORT_REASON_CODE_NOT_IN_CATALOG');
    expect(issues[0].message).toContain('AGE_NOT_ELIGIBLE');
    expect(issues[0].line).toBe(13);
  });

  it('pide declarar qué salida lleva el motivo cuando el contrato no lo dice', () => {
    const [issue] = reasonIssues(undefined, [], new Map(), locate);

    expect(issue.code).toBe('CODE_IMPORT_REASON_OUTPUT_UNDECLARED');
    // Es una carencia del contrato, no un motivo inventado: avisa, no bloquea.
    expect(issue.severity).toBe('WARNING');
  });
});

describe('allowedValueIssues', () => {
  it('rechaza un valor fuera de la lista que declara el catálogo', () => {
    const issues = allowedValueIssues(
      new Map([['decision', ['APROBADO', 'REVISION_MANUAL']]]),
      new Map([['decision', ['APROBADO', 'RECHAZADO']]]),
      locate,
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('REVISION_MANUAL');
    expect(issues[0].code).toBe('CODE_IMPORT_VALUE_NOT_ALLOWED');
  });

  it('no dice nada cuando el catálogo no restringe los valores', () => {
    expect(allowedValueIssues(new Map([['decision', ['LO_QUE_SEA']]]), new Map(), locate)).toEqual(
      [],
    );
  });
});
