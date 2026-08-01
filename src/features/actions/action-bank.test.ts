import { describe, expect, it } from 'vitest';
import {
  bankOptions,
  EMPTY_BANK_FILTERS,
  filterBank,
  toActionBank,
  type VersionGraph,
} from './action-bank';

/** Acciones con la forma real del motor. */
const SET_SCORE = {
  code: 'SET_IDENTITY_SCORE',
  type: 'SET_FIELD',
  terminal: false,
  payload: {
    field: 'identity_verification_score',
    valueExpression: { op: 'mul', args: [{ var: 'identity_confidence_score' }, { value: 0.3 }] },
  },
  reasonCodes: [],
};

const EMIT_KYC = {
  code: 'EMIT_KYC_INVALID',
  type: 'EMIT_REASON',
  terminal: true,
  payload: {},
  reasonCodes: [{ code: 'KYC_OR_CONSENT_INVALID' }],
};

const REVISION = {
  code: 'ABRIR_REVISION',
  type: 'CREATE_MANUAL_REVIEW',
  terminal: true,
  payload: { queueCode: 'FRAUDE_N2' },
  reasonCodes: [],
};

const BNPL: VersionGraph = {
  versionId: '592',
  artifactCode: 'BNPL_CREDIT_DECISION',
  artifactName: 'Decisión inicial de crédito BNPL',
  semanticVersion: '2.0.0',
  status: 'DEPLOYED_TO_PROD',
  actions: [SET_SCORE, EMIT_KYC, REVISION],
  nodes: [
    {
      key: 'COMPUTE',
      label: 'Calcular Identidad',
      actions: [{ actionCode: 'SET_IDENTITY_SCORE' }],
    },
    { key: 'RECHAZO', label: 'Rechazo KYC', actions: [{ actionCode: 'EMIT_KYC_INVALID' }] },
  ],
};

const FRAUDE: VersionGraph = {
  versionId: '590',
  artifactCode: 'SUBCHECK_FRAUD',
  artifactName: 'Sub-chequeo de fraude',
  semanticVersion: '1.0.0',
  status: 'VALIDATED',
  // El mismo código de emisión, más una copia divergente del cálculo: mismo
  // nombre, otro peso. Es la incoherencia que la forma por versión esconde.
  actions: [EMIT_KYC, { ...SET_SCORE, payload: { ...SET_SCORE.payload, field: 'otro_campo' } }],
  nodes: [
    { key: 'FIN', label: 'Fraude confirmado', actions: [{ actionCode: 'EMIT_KYC_INVALID' }] },
  ],
};

const bank = toActionBank([BNPL, FRAUDE]);
const entry = (code: string) => bank.find((row) => row.code === code)!;

describe('toActionBank', () => {
  it('reúne las acciones de todos los algoritmos sin duplicar códigos', () => {
    expect(bank.map((row) => row.code)).toEqual([
      'ABRIR_REVISION',
      'EMIT_KYC_INVALID',
      'SET_IDENTITY_SCORE',
    ]);
  });

  it('conserva de qué algoritmos viene cada acción', () => {
    expect(entry('EMIT_KYC_INVALID').algorithms).toBe(
      'BNPL_CREDIT_DECISION 2.0.0, SUBCHECK_FRAUD 1.0.0',
    );
    expect(entry('ABRIR_REVISION').origins).toHaveLength(1);
  });

  it('acumula los pasos que la ejecutan en todos los algoritmos', () => {
    expect(entry('EMIT_KYC_INVALID').usedBy).toBe('Rechazo KYC, Fraude confirmado');
    // Una acción que nadie ejecuta se queda sin texto: es lo que permite filtrarla.
    expect(entry('ABRIR_REVISION').usedBy).toBe('');
  });

  it('señala el mismo código definido de dos formas distintas', () => {
    expect(entry('SET_IDENTITY_SCORE').consistency).toBe('DIVERGE');
    expect(entry('EMIT_KYC_INVALID').consistency).toBe('COINCIDE');
  });

  it('traduce la expresión y las variables para poder leerlas y buscarlas', () => {
    expect(entry('SET_IDENTITY_SCORE').expression).toBe('identity_confidence_score × 0.3');
    expect(entry('SET_IDENTITY_SCORE').reads).toBe('identity_confidence_score');
    expect(entry('SET_IDENTITY_SCORE').writes).toBe('identity_verification_score');
  });

  it('dice qué implica cada tipo en lenguaje de negocio', () => {
    expect(entry('SET_IDENTITY_SCORE').implies).toContain('calcula y escribe un valor');
    expect(entry('EMIT_KYC_INVALID').implies).toContain('emite un motivo explicable');
    expect(entry('ABRIR_REVISION').implies).toContain('abre un caso de revisión manual');
  });

  it('marca si la acción cierra el flujo o deja continuar', () => {
    expect(entry('SET_IDENTITY_SCORE').terminal).toBe('CONTINÚA');
    expect(entry('EMIT_KYC_INVALID').terminal).toBe('CIERRA EL FLUJO');
  });

  it('ignora un grafo sin acciones en lugar de romperse', () => {
    expect(toActionBank([{ ...FRAUDE, actions: [], nodes: [] }])).toEqual([]);
  });
});

describe('filterBank', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterBank(bank, EMPTY_BANK_FILTERS)).toHaveLength(3);
  });

  it('busca por código, campo, variable, motivo y algoritmo a la vez', () => {
    expect(filterBank(bank, { ...EMPTY_BANK_FILTERS, search: 'identity' })).toHaveLength(1);
    expect(filterBank(bank, { ...EMPTY_BANK_FILTERS, search: 'KYC_OR_CONSENT' })).toHaveLength(1);
    expect(filterBank(bank, { ...EMPTY_BANK_FILTERS, search: 'FRAUDE_N2' })).toHaveLength(1);
    expect(filterBank(bank, { ...EMPTY_BANK_FILTERS, search: 'SUBCHECK' })).toHaveLength(2);
  });

  it('acota a un algoritmo sin perder las acciones compartidas', () => {
    const only = filterBank(bank, { ...EMPTY_BANK_FILTERS, algorithm: 'SUBCHECK_FRAUD' });

    expect(only.map((row) => row.code)).toEqual(['EMIT_KYC_INVALID', 'SET_IDENTITY_SCORE']);
  });

  it('encuentra las acciones que ningún paso ejecuta', () => {
    const orphans = filterBank(bank, { ...EMPTY_BANK_FILTERS, usage: 'huerfanas' });

    expect(orphans.map((row) => row.code)).toEqual(['ABRIR_REVISION']);
    expect(filterBank(bank, { ...EMPTY_BANK_FILTERS, usage: 'usadas' })).toHaveLength(2);
  });

  it('aísla las divergentes, que es la revisión de gobierno', () => {
    expect(
      filterBank(bank, { ...EMPTY_BANK_FILTERS, consistency: 'diverge' }).map((row) => row.code),
    ).toEqual(['SET_IDENTITY_SCORE']);
  });

  it('combina filtros sin devolver falsos positivos', () => {
    expect(
      filterBank(bank, { ...EMPTY_BANK_FILTERS, search: 'identity', type: 'EMIT_REASON' }),
    ).toEqual([]);
  });
});

describe('bankOptions', () => {
  it('ofrece sólo los tipos y algoritmos presentes, ordenados', () => {
    expect(bankOptions(bank)).toEqual({
      types: ['CREATE_MANUAL_REVIEW', 'EMIT_REASON', 'SET_FIELD'],
      algorithms: ['BNPL_CREDIT_DECISION', 'SUBCHECK_FRAUD'],
    });
  });
});
