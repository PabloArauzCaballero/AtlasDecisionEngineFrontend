import { describe, expect, it } from 'vitest';
import {
  isSensitiveClass,
  maskRecordDeep,
  maskValue,
  SENSITIVE_MASK,
  sensitiveCodesOfExecution,
} from './sensitivity';

describe('isSensitiveClass', () => {
  it.each(['PII', 'SENSITIVE_PII', 'SECRET'])('reconoce %s', (clase) => {
    expect(isSensitiveClass(clase)).toBe(true);
  });

  // `INTERNAL` es una clase y NO es sensible: comparar contra «tiene clase»
  // enmascararía el catálogo entero y volvería la traza ilegible.
  it.each(['INTERNAL', 'PUBLIC', 'CONFIDENTIAL', '', null, undefined])(
    'no considera sensible %j',
    (clase) => {
      expect(isSensitiveClass(clase)).toBe(false);
    },
  );
});

describe('maskValue', () => {
  it('oculta el valor cuando la clase es sensible', () => {
    expect(maskValue('9876543', 'PII')).toBe(SENSITIVE_MASK);
    expect(maskValue({ numero: '9876543' }, 'SENSITIVE_PII')).toBe(SENSITIVE_MASK);
  });

  it('enmascara aunque el backend haya mandado el valor en claro', () => {
    // El motor puede publicar el dato: la clasificación manda igualmente.
    expect(maskValue('Juan Pérez', 'PII')).not.toContain('Juan');
  });

  it('pinta normal lo que no lo es', () => {
    expect(maskValue(4200, 'INTERNAL')).toBe('4200');
    expect(maskValue({ a: 1 }, 'PUBLIC')).toBe('{"a":1}');
    expect(maskValue(false, 'PUBLIC')).toBe('false');
  });

  it('distingue «sin valor» de «oculto»', () => {
    expect(maskValue(null, 'PII')).toBe('—');
    expect(maskValue(undefined, 'INTERNAL')).toBe('—');
  });
});

describe('sensitiveCodesOfExecution', () => {
  const execution = {
    variables: [
      { variableCode: 'CI_NUMBER', sensitivityClass: 'PII' },
      { variableCode: 'MONTHLY_INCOME', sensitivityClass: 'INTERNAL' },
      { code: 'CARD_PAN', sensitivityClass: 'SECRET' },
      { variableCode: 'LEGACY_FLAG', sensitive: true },
    ],
  };

  it('reúne los códigos que el catálogo clasificó', () => {
    const codes = sensitiveCodesOfExecution(execution);
    expect([...codes].sort()).toEqual(['CARD_PAN', 'CI_NUMBER', 'LEGACY_FLAG']);
  });

  it('devuelve un conjunto vacío cuando la ejecución no trae variables', () => {
    expect(sensitiveCodesOfExecution({}).size).toBe(0);
  });
});

describe('maskRecordDeep', () => {
  const codes = new Set(['CI_NUMBER', 'CARD_PAN']);

  it('enmascara en la raíz y anidado, a cualquier profundidad', () => {
    const payload = {
      variables: { CI_NUMBER: '9876543', MONTHLY_INCOME: 12_000 },
      contexto: { anidado: { CARD_PAN: '4111111111111111' } },
    };
    expect(maskRecordDeep(payload, codes)).toEqual({
      variables: { CI_NUMBER: SENSITIVE_MASK, MONTHLY_INCOME: 12_000 },
      contexto: { anidado: { CARD_PAN: SENSITIVE_MASK } },
    });
  });

  it('recorre los arreglos', () => {
    expect(maskRecordDeep([{ CI_NUMBER: 'x' }, { otro: 1 }], codes)).toEqual([
      { CI_NUMBER: SENSITIVE_MASK },
      { otro: 1 },
    ]);
  });

  it('deja intacto el payload cuando no hay nada clasificado', () => {
    const payload = { CI_NUMBER: '9876543' };
    // Mismo objeto, no una copia: sin códigos no hay trabajo que hacer.
    expect(maskRecordDeep(payload, new Set())).toBe(payload);
  });

  it('no rompe con nulos ni con valores primitivos', () => {
    expect(maskRecordDeep(null, codes)).toBeNull();
    expect(maskRecordDeep('texto', codes)).toBe('texto');
    expect(maskRecordDeep({ a: null }, codes)).toEqual({ a: null });
  });
});
