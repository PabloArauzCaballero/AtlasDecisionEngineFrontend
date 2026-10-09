import type { IdentityUser } from '../../auth/auth.types';
import { effectiveRoles } from '../../auth/effective-roles';
import { hasAnyRole } from '../../auth/roles';
import { asRows, type UnknownRecord } from '../../utils/records';

/**
 * Quién puede decidir una solicitud de aprobación, y por qué no.
 *
 * El backend es la autoridad: rechaza con 403 la decisión que no corresponda.
 * Esto sólo evita ofrecer un botón que va a fallar y —más importante— evita que
 * un AUDITOR, que sólo entra a leer, crea que su clic aprueba un despliegue.
 *
 * La regla no se inventa aquí: cada paso del flujo llega con su `requiredRole`
 * desde el backend, así que el portal pregunta por ese rol en vez de mantener
 * una lista paralela que se desincronizaría al primer cambio de workflow.
 */

/** Estados en los que la solicitud ya no admite decisiones. */
const TERMINAL_STATUSES = new Set([
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'WITHDRAWN',
  'EXPIRED',
  'MERGED',
]);

/**
 * Roles admitidos cuando el paso no declara `requiredRole`.
 *
 * Es deliberadamente estrecho: ante un payload incompleto preferimos negar y
 * explicarlo antes que habilitar la aprobación de un despliegue por defecto.
 */
export const FALLBACK_APPROVER_ROLES = ['RISK_APPROVER', 'COMPLIANCE'] as const;

export interface DecisionGate {
  /** Paso pendiente que toca decidir, o `null` si no hay ninguno. */
  step: UnknownRecord | null;
  stepId: string | null;
  requiredRole: string | null;
  canDecide: boolean;
  /** Motivo del bloqueo, listo para mostrar. `null` cuando sí puede decidir. */
  reason: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function upper(value: unknown): string {
  return text(value).toUpperCase();
}

function stepOrder(step: UnknownRecord): number {
  const raw = Number(step.stepOrder);
  return Number.isFinite(raw) ? raw : Number.MAX_SAFE_INTEGER;
}

/**
 * Paso pendiente de menor orden: el que el flujo espera resolver ahora.
 *
 * La página anterior tomaba el primer `PENDING` del arreglo tal como venía, que
 * coincide sólo mientras el backend lo mande ordenado.
 */
export function activeApprovalStep(request: UnknownRecord): UnknownRecord | null {
  const pending = asRows(request.steps).filter((step) => upper(step.status) === 'PENDING');
  if (!pending.length) return null;
  return pending.reduce((lowest, step) => (stepOrder(step) < stepOrder(lowest) ? step : lowest));
}

/**
 * ¿La sesión actual es quien pidió la revisión?
 *
 * Separación de funciones: el autor de una versión no la aprueba él mismo
 * (docs/usuarios-roles-y-permisos.md). El backend lo vuelve a comprobar; aquí
 * sólo se explica antes de que el usuario escriba el comentario.
 */
export function isRequester(request: UnknownRecord, user: IdentityUser | null): boolean {
  const requester = upper(request.requestedBy);
  if (!requester || !user) return false;
  return [user.email, user.userCode, user.id, user.fullName]
    .map((value) => upper(value))
    .filter(Boolean)
    .includes(requester);
}

/** Evalúa si esta sesión puede decidir la solicitud, y con qué explicación. */
export function evaluateDecisionGate(
  request: UnknownRecord,
  user: IdentityUser | null,
): DecisionGate {
  const step = activeApprovalStep(request);
  const stepId = step ? text(step.id) || null : null;
  const requiredRole = step ? text(step.requiredRole).toUpperCase() || null : null;
  const blocked = (reason: string): DecisionGate => ({
    step,
    stepId,
    requiredRole,
    canDecide: false,
    reason,
  });

  const status = upper(request.status);
  if (TERMINAL_STATUSES.has(status)) {
    return blocked(`La solicitud ya está en estado ${status}: no admite nuevas decisiones.`);
  }
  if (!step) {
    return blocked('La solicitud no tiene ningún paso pendiente de decisión.');
  }
  if (!stepId) {
    return blocked('El paso pendiente llegó sin identificador; recarga antes de decidir.');
  }
  if (!user) {
    return blocked('No hay una sesión activa.');
  }
  if (isRequester(request, user)) {
    return blocked(
      'Solicitaste tú esta revisión: la separación de funciones exige que la decida otra persona.',
    );
  }

  const required = requiredRole ? [requiredRole] : [...FALLBACK_APPROVER_ROLES];
  if (!hasAnyRole(effectiveRoles(user), required)) {
    return blocked(
      requiredRole
        ? `Este paso requiere el rol ${requiredRole}; tu sesión no lo tiene.`
        : `El paso no declara rol requerido; sólo ${FALLBACK_APPROVER_ROLES.join(' o ')} puede decidirlo.`,
    );
  }

  return { step, stepId, requiredRole, canDecide: true, reason: null };
}

/** Fecha de la solicitud como número, para ordenar; sin fecha va al final. */
function requestedAtMs(request: UnknownRecord): number {
  const ms = Date.parse(text(request.requestedAt));
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

/**
 * De todas las solicitudes de una versión, la que hoy admite firma.
 *
 * La revisión de seguridad recibe el historial completo de solicitudes. Tomar «el primer paso
 * PENDING de cualquiera» firmaba sin ordenar y podía caer en una solicitud ya cerrada (un paso
 * que quedó PENDING en una solicitud RECHAZADA). Aquí: sólo solicitudes no terminales con un
 * paso pendiente, la más reciente; dentro de ella, el paso lo decide `activeApprovalStep`.
 */
export function activeGovernanceRequest(requests: readonly UnknownRecord[]): UnknownRecord | null {
  const open = requests.filter(
    (request) => !TERMINAL_STATUSES.has(upper(request.status)) && activeApprovalStep(request),
  );
  if (!open.length) return null;
  return open.reduce((latest, request) =>
    requestedAtMs(request) > requestedAtMs(latest) ? request : latest,
  );
}

export interface StepSignature {
  decidedBy: string;
  decision: string;
  decidedAt: string | null;
}

/** Quién firmó cada paso, en el orden en que llegaron las decisiones. */
export function stepSignatures(step: UnknownRecord): StepSignature[] {
  return asRows(step.decisions)
    .map((decision) => ({
      decidedBy: text(decision.decidedBy),
      decision: upper(decision.decision),
      decidedAt: text(decision.decidedAt) || null,
    }))
    .filter((signature) => signature.decidedBy);
}
