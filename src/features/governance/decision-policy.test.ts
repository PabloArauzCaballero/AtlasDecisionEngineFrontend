import type { IdentityUser } from '../../auth/auth.types';
import { activeApprovalStep, evaluateDecisionGate, isRequester } from './decision-policy';

function userWith(roles: string[], email = 'aprobador@atlas.bo'): IdentityUser {
  return {
    id: '7',
    tenantId: '1',
    email,
    fullName: 'Persona Aprobadora',
    name: 'Persona',
    userCode: 'APR-7',
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles,
    legacyRoles: [],
    permissions: [],
  };
}

const request = {
  id: '31',
  status: 'IN_REVIEW',
  requestedBy: 'autor@atlas.bo',
  steps: [
    { id: '2', stepOrder: 2, requiredRole: 'COMPLIANCE', status: 'PENDING' },
    { id: '1', stepOrder: 1, requiredRole: 'RISK_APPROVER', status: 'PENDING' },
    { id: '0', stepOrder: 0, requiredRole: 'QA_ANALYST', status: 'APPROVED' },
  ],
};

describe('activeApprovalStep', () => {
  it('toma el pendiente de menor orden, no el primero del arreglo', () => {
    expect(activeApprovalStep(request)?.id).toBe('1');
  });

  it('devuelve null cuando no queda nada pendiente', () => {
    expect(activeApprovalStep({ steps: [{ id: '1', status: 'APPROVED' }] })).toBeNull();
  });
});

describe('evaluateDecisionGate', () => {
  it('habilita la decisión a quien tiene el rol que el paso exige', () => {
    const gate = evaluateDecisionGate(request, userWith(['RISK_APPROVER']));
    expect(gate.canDecide).toBe(true);
    expect(gate.stepId).toBe('1');
    expect(gate.requiredRole).toBe('RISK_APPROVER');
    expect(gate.reason).toBeNull();
  });

  it('niega al AUDITOR, que entra a leer y no a firmar', () => {
    const gate = evaluateDecisionGate(request, userWith(['AUDITOR']));
    expect(gate.canDecide).toBe(false);
    expect(gate.reason).toContain('RISK_APPROVER');
  });

  it('niega al rol del paso siguiente mientras no le toque', () => {
    expect(evaluateDecisionGate(request, userWith(['COMPLIANCE'])).canDecide).toBe(false);
  });

  it('niega a quien solicitó la revisión: separación de funciones', () => {
    const gate = evaluateDecisionGate(
      request,
      userWith(['RISK_APPROVER', 'PLATFORM_ADMIN'], 'autor@atlas.bo'),
    );
    expect(gate.canDecide).toBe(false);
    expect(gate.reason).toContain('separación de funciones');
  });

  it('niega sobre una solicitud ya terminada', () => {
    const gate = evaluateDecisionGate(
      { ...request, status: 'REJECTED' },
      userWith(['RISK_APPROVER']),
    );
    expect(gate.canDecide).toBe(false);
    expect(gate.reason).toContain('REJECTED');
  });

  it('sin paso pendiente no hay nada que decidir', () => {
    const gate = evaluateDecisionGate(
      { ...request, steps: [{ id: '1', status: 'APPROVED' }] },
      userWith(['RISK_APPROVER']),
    );
    expect(gate.canDecide).toBe(false);
    expect(gate.stepId).toBeNull();
  });

  it('cae a los roles aprobadores estrechos si el paso no declara rol', () => {
    const withoutRole = { ...request, steps: [{ id: '9', stepOrder: 1, status: 'PENDING' }] };
    expect(evaluateDecisionGate(withoutRole, userWith(['QA_ANALYST'])).canDecide).toBe(false);
    expect(evaluateDecisionGate(withoutRole, userWith(['COMPLIANCE'])).canDecide).toBe(true);
  });

  it('sin sesión no se decide', () => {
    expect(evaluateDecisionGate(request, null).canDecide).toBe(false);
  });
});

describe('isRequester', () => {
  it('reconoce al solicitante por correo, código o identificador', () => {
    expect(isRequester({ requestedBy: 'APR-7' }, userWith([]))).toBe(true);
    expect(isRequester({ requestedBy: '7' }, userWith([]))).toBe(true);
    expect(isRequester({ requestedBy: 'otra@atlas.bo' }, userWith([]))).toBe(false);
  });

  it('una solicitud sin solicitante no señala a nadie', () => {
    expect(isRequester({}, userWith([]))).toBe(false);
  });
});
