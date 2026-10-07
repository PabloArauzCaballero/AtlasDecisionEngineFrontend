import { describe, expect, it } from 'vitest';
import { explainSubmitError, submitBlockerForStatus } from './submit-review';

describe('enviar una versión a revisión', () => {
  it('sólo una versión compilada puede enviarse', () => {
    expect(submitBlockerForStatus('COMPILED')).toBeNull();
    expect(submitBlockerForStatus('compiled')).toBeNull();
  });

  it('a un borrador le dice que falta compilar, no que «ya pasó por revisión»', () => {
    expect(submitBlockerForStatus('DRAFT')).toContain('compílala');
    expect(submitBlockerForStatus('VALIDATED')).toContain('compílala');
  });

  it('a lo ya revisado le dice que hace falta una versión nueva', () => {
    expect(submitBlockerForStatus('IN_REVIEW')).toContain('tabla de abajo');
    expect(submitBlockerForStatus('APPROVED')).toContain('versión nueva');
    expect(submitBlockerForStatus('CHANGES_REQUESTED')).toContain('versión nueva');
  });

  it('sin estado conocido no inventa un bloqueo', () => {
    expect(submitBlockerForStatus(null)).toBeNull();
    expect(submitBlockerForStatus(undefined)).toBeNull();
  });

  it('traduce los rechazos del motor y no inventa los que no conoce', () => {
    expect(explainSubmitError('BLOCKING_TESTS_NOT_PASSED')).toContain('pruebas bloqueantes');
    expect(explainSubmitError('APPROVAL_REQUEST_EXISTS')).toContain('solicitud abierta');
    expect(explainSubmitError('OTRO_CODIGO')).toBeNull();
    expect(explainSubmitError(undefined)).toBeNull();
  });
});
