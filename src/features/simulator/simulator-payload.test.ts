import { missingRequired, seedPayload, seedValue } from './simulator-payload';

const variable = (overrides: Record<string, unknown>) => ({
  variableCode: 'x',
  dataType: 'STRING',
  isRequired: true,
  ...overrides,
});

describe('seedValue', () => {
  it('usa el valor por defecto declarado', () => {
    expect(seedValue(variable({ defaultValue: 'VERIFIED' }))).toBe('VERIFIED');
  });

  it('usa el primer valor admitido cuando la variable es un enum', () => {
    expect(
      seedValue(variable({ validationSchema: { enum: ['VERIFIED', 'PENDING', 'REJECTED'] } })),
    ).toBe('VERIFIED');
  });

  it('respeta el mínimo exclusivo de un importe (0 no sería válido)', () => {
    expect(
      seedValue(variable({ dataType: 'NUMBER', validationSchema: { exclusiveMinimum: 0 } })),
    ).toBe(1);
  });

  it('cae en valores neutros por tipo', () => {
    expect(seedValue(variable({ dataType: 'INTEGER' }))).toBe(0);
    expect(seedValue(variable({ dataType: 'BOOLEAN' }))).toBe(false);
    expect(seedValue(variable({ dataType: 'STRING' }))).toBe('');
  });
});

describe('seedPayload', () => {
  const inputs = [
    variable({ variableCode: 'kyc_status', validationSchema: { enum: ['VERIFIED', 'PENDING'] } }),
    variable({ variableCode: 'age', dataType: 'INTEGER', validationSchema: { minimum: 18 } }),
  ];

  it('siembra las variables del artefacto y descarta las de otro artefacto', () => {
    // `requestedAmount` venía del ejemplo fijo anterior: es lo que provocaba
    // NO_DECISION · VARIABLE_MISSING_OR_INVALID en cada simulación.
    expect(seedPayload(inputs, { requestedAmount: 1500, age: 30 })).toEqual({
      kyc_status: 'VERIFIED',
      age: 30,
    });
  });

  it('conserva lo ya escrito para una variable del contrato', () => {
    expect(seedPayload(inputs, { kyc_status: 'PENDING' }).kyc_status).toBe('PENDING');
  });
});

describe('missingRequired', () => {
  it('lista sólo las obligatorias sin valor', () => {
    const inputs = [
      variable({ variableCode: 'a' }),
      variable({ variableCode: 'b' }),
      variable({ variableCode: 'c', isRequired: false }),
    ];
    expect(missingRequired(inputs, { a: 'ok', b: '', c: '' })).toEqual(['b']);
  });
});
