import { describe, expect, it } from 'vitest';
import { describeTypeShape, explainConstraints } from './constraint-details';
import { describeConstraints, parseConstraints } from './constraints';
import { describeCondition, describeScopeMatch } from './constraint-scopes';
import { variableOriginLabel } from './data-types';

/**
 * La ficha de una variable existe para responder «¿qué valor puedo mandar?». Estas
 * pruebas fijan lo que hacía falta y no estaba: los valores permitidos NOMBRADOS, el
 * comportamiento en el borde de cada límite y los tramos que sólo aplican a veces.
 */
describe('explicación detallada de un contrato', () => {
  it('distingue el borde inclusivo del exclusivo', () => {
    const details = explainConstraints('INTEGER', { min: 0, exclusiveMax: 100 });
    const min = details.find((detail) => detail.key === 'min');
    const max = details.find((detail) => detail.key === 'exclusiveMax');
    expect(min?.note).toContain('SÍ se acepta');
    expect(max?.note).toContain('NO se acepta');
  });

  it('publica el código con el que el motor rechaza cada restricción', () => {
    const codes = explainConstraints('STRING', { maxLength: 3, pattern: '^A' }).map(
      (detail) => detail.code,
    );
    expect(codes).toEqual(['TOO_LONG', 'PATTERN_MISMATCH']);
  });

  it('avisa de que un patrón sin anclar casa sólo una parte del texto', () => {
    const [suelto] = explainConstraints('STRING', { pattern: 'A' });
    const [anclado] = explainConstraints('STRING', { pattern: '^A$' });
    expect(suelto.note).toContain('PARTE');
    expect(anclado.note).toContain('COMPLETO');
  });

  it('cuenta elementos, no caracteres, cuando el tipo es una lista', () => {
    const [detail] = explainConstraints('LIST', { minLength: 2 });
    expect(detail.value).toBe('2 elementos');
  });

  it('describe la forma que el tipo exige por sí solo', () => {
    expect(describeTypeShape('PERCENTAGE')).toContain('0 y 100');
    expect(describeTypeShape('DATE')).toContain('AAAA-MM-DD');
  });
});

describe('resumen para el chip', () => {
  it('nombra los valores permitidos en vez de contarlos', () => {
    const summary = describeConstraints({ allowedValues: ['PASS', 'REVIEW', 'FAIL'] });
    expect(summary).toEqual(['sólo: PASS, REVIEW, FAIL']);
  });

  it('vuelve al recuento cuando la lista no cabe en una línea', () => {
    const largos = Array.from({ length: 8 }, (_, index) => `VALOR_LARGUISIMO_${index}`);
    expect(describeConstraints({ allowedValues: largos })).toEqual(['8 valores permitidos']);
  });
});

describe('restricciones que sólo aplican a veces', () => {
  it('conserva los tramos por eje y las reglas condicionales', () => {
    const parsed = parseConstraints({
      minimum: 0,
      dependsOn: ['country'],
      conditional: [{ whenField: 'country', operator: 'EQUALS', value: 'BO', constraints: {} }],
      byCountry: [{ match: ['BO'], constraints: { maximum: 10 } }],
    });
    expect(parsed.dependsOn).toEqual(['country']);
    expect(parsed.conditional).toHaveLength(1);
    expect(parsed.byCountry).toHaveLength(1);
  });

  it('descarta reglas condicionales con un operador que el motor no conoce', () => {
    const parsed = parseConstraints({
      conditional: [{ whenField: 'country', operator: 'SEMEJANTE_A', value: 'BO' }],
    });
    expect(parsed.conditional).toBeUndefined();
  });

  it('escribe la condición y el tramo en lenguaje llano', () => {
    expect(
      describeCondition({
        whenField: 'tipo_documento',
        operator: 'IN',
        value: ['CI', 'PASAPORTE'],
      }),
    ).toBe('Si tipo_documento está entre CI, PASAPORTE');
    expect(describeCondition({ whenField: 'aval', operator: 'PRESENT' })).toBe(
      'Si aval tiene valor',
    );
    expect(describeScopeMatch({ match: [] })).toContain('cualquier valor');
  });
});

describe('origen esperado', () => {
  it('traduce los orígenes conocidos y respeta los que no lo son', () => {
    expect(variableOriginLabel('REQUEST')).toContain('quien pide la decisión');
    expect(variableOriginLabel('ATLAS_BACKEND')).toBe('ATLAS_BACKEND');
    expect(variableOriginLabel(null)).toBe('—');
  });
});
