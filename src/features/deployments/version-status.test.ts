import { describe, expect, it } from 'vitest';
import { esVersionDesplegable, esVersionEditable, motivoSinEdicion } from './version-status';

describe('esVersionDesplegable', () => {
  it('admite las aprobadas y las ya desplegadas (para promoverlas)', () => {
    for (const estado of [
      'APPROVED',
      'DEPLOYED_TO_STAGING',
      'deployed_to_prod',
      'DEPLOYED_TO_DEV',
      'DEPLOYED_TO_TEST',
    ]) {
      expect(esVersionDesplegable(estado)).toBe(true);
    }
  });

  it('rechaza borradores, compiladas, en revisión y lo que no sea un estado', () => {
    for (const estado of [
      'DRAFT',
      'COMPILED',
      'IN_REVIEW',
      'VALIDATION_FAILED',
      '',
      undefined,
      null,
    ]) {
      expect(esVersionDesplegable(estado)).toBe(false);
    }
  });
});

describe('esVersionEditable', () => {
  it('sólo el borrador y el que falló la validación se pueden editar', () => {
    expect(esVersionEditable('DRAFT')).toBe(true);
    expect(esVersionEditable('validation_failed')).toBe(true);
  });

  it('una desplegada, aprobada o compilada es inmutable', () => {
    for (const estado of ['APPROVED', 'COMPILED', 'DEPLOYED_TO_STAGING', 'IN_REVIEW', undefined]) {
      expect(esVersionEditable(estado)).toBe(false);
    }
  });
});

describe('motivoSinEdicion', () => {
  it('sin versión elegida no añade motivo propio (lo explica el selector)', () => {
    expect(motivoSinEdicion('', null)).toBeNull();
  });

  it('con la versión elegida pero sin cargar pide cargarla', () => {
    expect(motivoSinEdicion('9', null)).toMatch(/Cargar/);
    expect(motivoSinEdicion('9', { id: '8', status: 'DRAFT' })).toMatch(/Cargar/);
  });

  it('una versión cargada que no es borrador no se puede modificar y dice su estado', () => {
    expect(motivoSinEdicion('8', { id: '8', status: 'DEPLOYED_TO_STAGING' })).toMatch(
      /DEPLOYED_TO_STAGING/,
    );
  });

  it('un borrador cargado sí', () => {
    expect(motivoSinEdicion('9', { id: '9', status: 'DRAFT' })).toBeNull();
    expect(motivoSinEdicion('9', { id: '9', status: 'VALIDATION_FAILED' })).toBeNull();
  });
});
