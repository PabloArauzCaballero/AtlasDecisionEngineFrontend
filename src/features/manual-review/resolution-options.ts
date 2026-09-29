import type { Option } from '../../contracts/option';

/**
 * Las tres salidas de una revisión manual, con los valores EXACTOS que acepta el motor
 * (`ResolveManualReviewDto`: `@IsIn(['APPROVE', 'DECLINE', 'CANCEL'])`).
 *
 * La pantalla ofrecía `APPROVE | REJECT | ESCALATE` y mandaba el valor sin traducir: «Rechazar» y
 * «Escalar» morían en un 400 y sólo «Aprobar» funcionaba. «Escalar» además prometía «un nivel
 * superior de revisión» que el motor no tiene (no hay cola de segundo nivel ni estado que lo
 * represente), así que se retiró en vez de mapearlo a otra cosa.
 *
 * El valor que viaja es el del contrato; lo que ve la persona es el rótulo.
 */
export type ManualReviewDecision = 'APPROVE' | 'DECLINE' | 'CANCEL';

/** Cómo quedó resuelto un caso, en minúsculas para las frases de aviso. */
export const RESOLUTION_LABEL: Record<ManualReviewDecision, string> = {
  APPROVE: 'aprobado',
  DECLINE: 'rechazado',
  CANCEL: 'cancelado',
};

/** Frase que confirma qué pasó con el caso; «cancelar» no decide, y no debe sonar a que sí. */
export const RESOLUTION_OUTCOME_TEXT: Record<ManualReviewDecision, string> = {
  APPROVE: 'se resolvió como aprobado y salió de la cola.',
  DECLINE: 'se resolvió como rechazado y salió de la cola.',
  CANCEL: 'se retiró de la cola sin decidir: la solicitud queda como estaba.',
};

export const RESOLUTION_OPTIONS: Option[] = [
  {
    value: 'APPROVE',
    label: 'Aprobar',
    description: 'Resuelve el caso a favor de la solicitud.',
  },
  {
    value: 'DECLINE',
    label: 'Rechazar',
    description: 'Resuelve el caso en contra de la solicitud.',
  },
  {
    value: 'CANCEL',
    label: 'Cancelar caso',
    description:
      'Retira el caso de la cola sin decidir nada: la solicitud queda como estaba y alguien tendrá que revisarla otra vez.',
  },
];

/** Estados en los que el caso ya no admite resolución (el motor contesta 409 `MANUAL_REVIEW_CLOSED`). */
export const CLOSED_CASE_STATUSES: readonly string[] = [
  'RESOLVED_APPROVED',
  'RESOLVED_DECLINED',
  'CANCELLED',
];

/** Estado del caso en palabras de operaciones (columna de la cola y ficha del caso). */
export const CASE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Sin tomar',
  ASSIGNED: 'Asignado',
  RESOLVED_APPROVED: 'Aprobado',
  RESOLVED_DECLINED: 'Rechazado',
  CANCELLED: 'Cancelado',
};
