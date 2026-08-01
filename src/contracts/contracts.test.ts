import { describe, expect, it } from 'vitest';
import {
  DATA_TYPES,
  DATA_TYPE_LABELS,
  SENSITIVITY_CLASSES,
  SENSITIVITY_LABELS,
  TRACE_POLICIES,
  TRACE_POLICY_LABELS,
  dataTypeLabel,
  normalizeDataType,
} from './data-types';
import { describeConstraints, parseConstraints, previewValidate } from './constraints';

/**
 * Este módulo es un espejo del contrato del backend. Si se desincroniza, el editor
 * ofrece opciones que el servidor rechaza y el autor no entiende por qué, así que las
 * pruebas fijan tanto la lista de tipos como la equivalencia de las reglas.
 */
describe('catálogo de tipos', () => {
  it('todos los tipos tienen etiqueta legible', () => {
    for (const type of DATA_TYPES) {
      expect(DATA_TYPE_LABELS[type]).toBeTruthy();
      expect(DATA_TYPE_LABELS[type]).not.toBe(type);
    }
  });

  it('todas las clasificaciones y políticas de traza tienen etiqueta', () => {
    for (const value of SENSITIVITY_CLASSES) expect(SENSITIVITY_LABELS[value]).toBeTruthy();
    for (const value of TRACE_POLICIES) expect(TRACE_POLICY_LABELS[value]).toBeTruthy();
  });

  it('normaliza los alias históricos igual que el backend', () => {
    expect(normalizeDataType('NUMBER')).toBe('DECIMAL');
    expect(normalizeDataType('text')).toBe('STRING');
    expect(normalizeDataType('ARRAY')).toBe('LIST');
    expect(normalizeDataType('UUID')).toBe('IDENTIFIER');
    // Un tipo desconocido cae a texto en vez de romper la vista.
    expect(normalizeDataType('marciano')).toBe('STRING');
    expect(dataTypeLabel('NUMBER')).toBe('Número decimal');
  });
});

describe('lectura de restricciones', () => {
  it('acepta la forma normalizada y el JSON Schema legado', () => {
    expect(parseConstraints({ minimum: 1, maximum: 9, enum: ['A'] })).toEqual({
      min: 1,
      max: 9,
      allowedValues: ['A'],
    });
    expect(parseConstraints({ min: 1, allowedValues: ['A'] })).toEqual({
      min: 1,
      allowedValues: ['A'],
    });
  });

  it('descarta valores con forma inesperada', () => {
    expect(parseConstraints({ min: 'diez', pattern: 5 })).toEqual({});
    expect(parseConstraints(undefined)).toEqual({});
  });

  it('resume las restricciones para el chip de la UI', () => {
    const summary = describeConstraints({ min: 0, max: 100, scale: 2 });
    expect(summary).toEqual(['mín 0', 'máx 100', '2 decimales']);
  });
});

describe('comprobación previa de un valor', () => {
  it('valida el tipo antes que los rangos', () => {
    expect(previewValidate('INTEGER', { min: 10 }, 'x')).toEqual(['se esperaba un número']);
    expect(previewValidate('INTEGER', {}, 5.5)).toEqual(['se esperaba un número entero']);
  });

  it('reporta todas las restricciones incumplidas', () => {
    const errors = previewValidate('STRING', { minLength: 5, pattern: '^\\d+$' }, 'ab');
    expect(errors).toHaveLength(2);
  });

  it('acepta un valor que cumple todo', () => {
    expect(previewValidate('DECIMAL', { min: 0, max: 1, scale: 3 }, 0.375)).toEqual([]);
  });

  it('acota los porcentajes al rango 0-100', () => {
    expect(previewValidate('PERCENTAGE', {}, 42)).toEqual([]);
    expect(previewValidate('PERCENTAGE', {}, 120)).toEqual([
      'un porcentaje debe estar entre 0 y 100',
    ]);
  });

  it('valida fechas y horas con formato ISO', () => {
    expect(previewValidate('DATE', {}, '2026-07-30')).toEqual([]);
    expect(previewValidate('DATE', {}, '30/07/2026')).toEqual(['se esperaba una fecha AAAA-MM-DD']);
  });

  it('valida listas: cardinalidad y unicidad', () => {
    expect(previewValidate('LIST', { maxItems: 2 }, [1, 2, 3])).toEqual([
      'no puede superar 2 elementos',
    ]);
    expect(previewValidate('LIST', { unique: true }, [1, 1])).toEqual([
      'los elementos deben ser distintos',
    ]);
  });

  it('un patrón inválido no rompe el editor', () => {
    // Un regex mal escrito debe degradarse a "no opino", nunca lanzar.
    expect(() => previewValidate('STRING', { pattern: '([' }, 'abc')).not.toThrow();
    expect(previewValidate('STRING', { pattern: '([' }, 'abc')).toEqual([]);
  });

  it('un patrón catastrófico no cuelga la vista', () => {
    const evil = '(a+)+$'.repeat(40);
    const started = Date.now();
    previewValidate('STRING', { pattern: evil }, 'a'.repeat(60));
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('aplica la lista de valores permitidos', () => {
    expect(previewValidate('ENUM', { allowedValues: ['A', 'B'] }, 'C')).toEqual([
      'no está entre los valores permitidos',
    ]);
    expect(previewValidate('ENUM', { allowedValues: ['A', 'B'] }, 'A')).toEqual([]);
  });
});
