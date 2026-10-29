import { describe, expect, it } from 'vitest';
import { esVersionDesplegable, esVersionEditable } from './version-status';

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
