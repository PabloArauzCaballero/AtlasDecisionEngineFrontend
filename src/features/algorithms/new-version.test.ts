import { describe, expect, it } from 'vitest';
import {
  isEditableVersionStatus,
  newVersionBlocker,
  suggestNextSemanticVersion,
  toClonePayload,
} from './new-version';

describe('crear una versión nueva de un algoritmo', () => {
  it('sólo un borrador (o su validación) se edita; lo aprobado o desplegado pide versión nueva', () => {
    expect(isEditableVersionStatus('DRAFT')).toBe(true);
    expect(isEditableVersionStatus('validated')).toBe(true);
    expect(isEditableVersionStatus('VALIDATION_FAILED')).toBe(true);
    for (const status of [
      'COMPILED',
      'PENDING_APPROVAL',
      'IN_REVIEW',
      'APPROVED',
      'DEPLOYED',
      'REJECTED',
      undefined,
    ]) {
      expect(isEditableVersionStatus(status)).toBe(false);
    }
  });

  it('propone la siguiente versión menor y no adivina lo que no es mayor.menor.parche', () => {
    expect(suggestNextSemanticVersion('2.1.0')).toBe('2.2.0');
    expect(suggestNextSemanticVersion('1.9.7')).toBe('1.10.0');
    expect(suggestNextSemanticVersion('7')).toBe('');
    expect(suggestNextSemanticVersion(undefined)).toBe('');
  });

  it('exige contar qué cambia, y un número de versión bien formado si se escribe', () => {
    expect(newVersionBlocker({ changeSummary: 'corto', semanticVersion: '' })).toContain(
      'qué cambia',
    );
    expect(
      newVersionBlocker({ changeSummary: 'Vetos antes del puntaje', semanticVersion: 'v2' }),
    ).toContain('2.3.0');
    expect(
      newVersionBlocker({ changeSummary: 'Vetos antes del puntaje', semanticVersion: '' }),
    ).toBeNull();
    expect(
      newVersionBlocker({ changeSummary: 'Vetos antes del puntaje', semanticVersion: ' 2.2.0 ' }),
    ).toBeNull();
  });

  it('el número de versión sólo viaja si se escribió', () => {
    expect(
      toClonePayload({ changeSummary: '  Vetos antes del puntaje ', semanticVersion: '' }),
    ).toEqual({
      changeSummary: 'Vetos antes del puntaje',
    });
    expect(
      toClonePayload({ changeSummary: 'Vetos antes del puntaje', semanticVersion: '2.2.0' }),
    ).toEqual({
      changeSummary: 'Vetos antes del puntaje',
      semanticVersion: '2.2.0',
    });
  });
});
