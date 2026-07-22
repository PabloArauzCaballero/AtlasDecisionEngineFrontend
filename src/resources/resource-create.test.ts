import { describe, expect, it } from 'vitest';
import { buildPayload, initialValues, normalizeCode } from './resource-create';
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
