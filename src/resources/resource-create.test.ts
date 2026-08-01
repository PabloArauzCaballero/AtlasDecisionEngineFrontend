import { describe, expect, it } from 'vitest';
import {
  buildPayload,
  initialValues,
  jsonFieldErrors,
  normalizeCode,
  parseJsonFieldValue,
} from './resource-create';
import { variablesCreateFields } from './resource.create-fields';
import type { CreateField } from './resource.types';

describe('normalizeCode', () => {
  it('uppercases and strips characters outside [A-Z0-9_-]', () => {
    expect(normalizeCode('a.b c-d_e!')).toBe('ABC-D_E');
    expect(normalizeCode('ingreso_mensual-2026')).toBe('INGRESO_MENSUAL-2026');
  });
});

describe('initialValues', () => {
  it('seeds checkboxes to their boolean default and text fields to empty', () => {
    const fields: CreateField[] = [
      { key: 'code', label: 'Código' },
      { key: 'isSensitive', label: 'Sensible', kind: 'checkbox', defaultValue: true },
      { key: 'isAdverse', label: 'Adverse', kind: 'checkbox' },
      { key: 'preset', label: 'Preset', defaultValue: 'DIRECT' },
    ];
    expect(initialValues(fields)).toEqual({
      code: '',
      isSensitive: true,
      isAdverse: false,
      preset: 'DIRECT',
    });
  });
});

describe('buildPayload', () => {
  it('trims text, keeps required fields and drops optional empty ones', () => {
    const fields: CreateField[] = [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'note', label: 'Nota' },
    ];
    expect(buildPayload(fields, { name: '  Scoring  ', note: '   ' })).toEqual({ name: 'Scoring' });
  });

  it('coerces checkbox fields to real booleans', () => {
    const fields: CreateField[] = [{ key: 'isActive', label: 'Activo', kind: 'checkbox' }];
    expect(buildPayload(fields, { isActive: true })).toEqual({ isActive: true });
    expect(buildPayload(fields, { isActive: false })).toEqual({ isActive: false });
  });

  it('nests dotted keys into an object', () => {
    const fields: CreateField[] = [
      { key: 'initialVersion.dataType', label: 'Tipo', required: true },
      { key: 'initialVersion.nullable', label: 'Nulos', kind: 'checkbox' },
    ];
    expect(
      buildPayload(fields, {
        'initialVersion.dataType': 'STRING',
        'initialVersion.nullable': true,
      }),
    ).toEqual({ initialVersion: { dataType: 'STRING', nullable: true } });
  });

  it('envía un campo json con su tipo real, no como cadena', () => {
    const fields: CreateField[] = [
      { key: 'initialVersion.exampleValid', label: 'Ejemplo válido', kind: 'json' },
      { key: 'initialVersion.constraints', label: 'Restricciones', kind: 'json' },
    ];
    expect(
      buildPayload(fields, {
        'initialVersion.exampleValid': '2500.5',
        'initialVersion.constraints': '{ "min": 0, "max": 100000 }',
      }),
    ).toEqual({
      initialVersion: { exampleValid: 2500.5, constraints: { min: 0, max: 100000 } },
    });
  });

  it('deep-merges staticBody beneath the form without mutating it', () => {
    const fields: CreateField[] = [
      { key: 'initialVersion.dataType', label: 'Tipo', required: true },
    ];
    const staticBody = { initialVersion: { sources: [], validationRules: [] } };
    const payload = buildPayload(fields, { 'initialVersion.dataType': 'INTEGER' }, staticBody);

    expect(payload).toEqual({
      initialVersion: { sources: [], validationRules: [], dataType: 'INTEGER' },
    });
    // staticBody must stay pristine for the next submit.
    expect(staticBody).toEqual({ initialVersion: { sources: [], validationRules: [] } });
  });
});

describe('campos json del contrato de variable (§1.1)', () => {
  it('interpreta números, booleanos y objetos con su tipo', () => {
    expect(parseJsonFieldValue('2500.5')).toEqual({ valid: true, value: 2500.5 });
    expect(parseJsonFieldValue('true')).toEqual({ valid: true, value: true });
    expect(parseJsonFieldValue('{"min":0}')).toEqual({ valid: true, value: { min: 0 } });
  });

  it('acepta texto suelto como cadena sin obligar a entrecomillar', () => {
    // Es lo que un analista escribe como ejemplo de una variable de texto.
    expect(parseJsonFieldValue('aprobado')).toEqual({ valid: true, value: 'aprobado' });
  });

  it('rechaza un JSON a medias en vez de mandarlo como cadena', () => {
    // Aquí la intención era estructurada: mandarlo como texto sería un 422 sin
    // explicación después de haber rellenado todo el formulario.
    expect(parseJsonFieldValue('{"min":').valid).toBe(false);
    expect(parseJsonFieldValue('[1, 2').valid).toBe(false);
  });

  it('jsonFieldErrors ignora los campos vacíos y señala solo los rotos', () => {
    const fields: CreateField[] = [
      { key: 'a', label: 'Restricciones', kind: 'json' },
      { key: 'b', label: 'Ejemplo válido', kind: 'json' },
      { key: 'c', label: 'Nombre' },
    ];
    const errors = jsonFieldErrors(fields, { a: '   ', b: '{"min":', c: 'no soy json' });
    expect(Object.keys(errors)).toEqual(['b']);
    expect(errors.b).toContain('Ejemplo válido');
  });
});

describe('alta de variable con el contrato de §1.1', () => {
  const keys = variablesCreateFields.map((field) => field.key);

  it('el alta pide mensaje de validación, ejemplos y origen esperado', () => {
    // Eran justo los que faltaban: la variable nacía sin contrato y había que
    // volver a editarla para completarlo.
    expect(keys).toEqual(
      expect.arrayContaining([
        'initialVersion.constraints',
        'initialVersion.validationMessage',
        'initialVersion.exampleValid',
        'initialVersion.exampleInvalid',
        'initialVersion.expectedOrigin',
        'initialVersion.unitCode',
      ]),
    );
  });

  it('los campos nuevos son opcionales: el alta rápida sigue siendo posible', () => {
    const added = variablesCreateFields.filter((field) => keys.indexOf(field.key) >= 8);
    expect(added.every((field) => !field.required)).toBe(true);
  });

  it('el origen esperado es una enumeración cerrada, no texto libre', () => {
    const origin = variablesCreateFields.find(
      (field) => field.key === 'initialVersion.expectedOrigin',
    );
    expect(origin?.kind).toBe('select');
    expect(origin?.options?.map((option) => option.value)).toEqual([
      'REQUEST',
      'PROVIDER',
      'DERIVED',
      'CALCULATED_FIELD',
      'GRAPH_NODE',
    ]);
  });
});
