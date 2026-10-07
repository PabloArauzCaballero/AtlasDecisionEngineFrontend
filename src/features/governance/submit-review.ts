import { ARTIFACT_STATUS_LABEL } from '../../resources/artifact-status';

/**
 * Enviar una versión a revisión: cuándo se puede y qué decir cuando no.
 *
 * El motor sólo acepta una versión `COMPILED` con sus pruebas bloqueantes en verde y sin otra solicitud abierta
 * (`GovernanceService.submitForReview`). Aquí se refleja para decirlo ANTES de pulsar; el motor decide igual.
 *
 * Existe porque la ruta `/reviews` pintaba sólo la tabla de solicitudes: el formulario de envío vivía en una
 * pantalla (`ReviewsPage`) que ninguna ruta importaba, así que «Validar y compilar → Ir a Revisiones» llevaba a
 * un listado sin forma de enviar nada.
 */

/** Por qué esta versión todavía no puede enviarse, o `null` si su estado lo permite. */
export function submitBlockerForStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  const normalized = status.toUpperCase();
  if (normalized === 'COMPILED') return null;
  const label = ARTIFACT_STATUS_LABEL[normalized] ?? normalized;
  if (normalized === 'DRAFT' || normalized === 'VALIDATION_FAILED' || normalized === 'VALIDATED') {
    return `Está «${label}»: primero valídala y compílala en «Validar y compilar».`;
  }
  if (normalized === 'IN_REVIEW') return 'Ya está en revisión: búscala en la tabla de abajo.';
  if (normalized === 'CHANGES_REQUESTED') {
    return 'Le pidieron cambios: crea una versión nueva desde ella, corrígela y compílala.';
  }
  return `Está «${label}»: ya pasó por revisión. Para cambiar el algoritmo crea una versión nueva.`;
}

const SUBMIT_ERRORS: Readonly<Record<string, string>> = {
  VERSION_NOT_REVIEWABLE:
    'El motor sólo acepta versiones compiladas. Compílala en «Validar y compilar» y vuelve a enviarla.',
  BLOCKING_TESTS_NOT_PASSED:
    'Sus pruebas bloqueantes no están en verde. Ejecútalas en «Pruebas» de esa versión; sin eso no entra a revisión.',
  APPROVAL_REQUEST_EXISTS:
    'Esta versión ya tiene una solicitud abierta: búscala en la tabla de abajo.',
  VERSION_NOT_FOUND: 'Esa versión ya no existe. Elige otra.',
};

/** El motivo del rechazo del motor en lenguaje llano, o `null` si el código no es de los conocidos. */
export function explainSubmitError(code: string | undefined): string | null {
  return code ? (SUBMIT_ERRORS[code] ?? null) : null;
}
