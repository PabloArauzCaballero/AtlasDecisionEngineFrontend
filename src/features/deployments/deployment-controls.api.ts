import { apiRequest } from '../../api/http-client';

/**
 * Revertir y suspender un despliegue, desde el portal.
 *
 * El motor publicaba las dos operaciones desde hacía meses y ninguna vista las llamaba. La
 * consecuencia no era «una función menos»: era que **la única forma de revertir producción
 * pasaba por fuera del portal** —consola, cliente HTTP, lo que hubiera a mano— y por tanto sin
 * el registro que el portal aporta. En el momento en que más importa saber quién decidió qué
 * (el incidente), la respuesta era «alguien, desde algún sitio».
 *
 * El motor exige `reason` y lo persiste. Aquí no se le pone valor por omisión ni se rellena con
 * algo como «reversión desde el portal»: un motivo automático es peor que ninguno, porque llena
 * el expediente de texto que parece una explicación y no lo es.
 *
 * Ambas exigen `PLATFORM_ADMIN` en el motor. El portal lo comprueba también antes de enseñar el
 * control, no para sustituir esa comprobación —el motor revalida siempre— sino para no ofrecer
 * un botón que va a devolver 403.
 */
export interface DeploymentControlResult {
  readonly deploymentId: string;
  readonly status: string;
}

/**
 * Revierte un despliegue al anterior de su ambiente.
 *
 * Devuelve lo que responda el motor sin reinterpretarlo: el estado resultante lo decide él, y
 * un portal que adivinara «ROLLED_BACK» pintaría un desenlace que quizá no ocurrió.
 */
export function rollbackDeployment(
  deploymentId: string,
  reason: string,
  signal?: AbortSignal,
): Promise<DeploymentControlResult> {
  return apiRequest<DeploymentControlResult>(
    `/v1/deployments/${encodeURIComponent(deploymentId)}/rollback`,
    { method: 'POST', body: { reason }, signal },
  );
}

/** Suspende un despliegue e invalida su enlace en ejecución. */
export function suspendDeployment(
  deploymentId: string,
  reason: string,
  signal?: AbortSignal,
): Promise<DeploymentControlResult> {
  return apiRequest<DeploymentControlResult>(
    `/v1/deployments/${encodeURIComponent(deploymentId)}/suspend`,
    { method: 'POST', body: { reason }, signal },
  );
}

/** Tope del motor para `reason`. Se valida también aquí para avisar antes de enviar. */
export const MAX_REASON_LENGTH = 8000;

/** Mínimo para que el motivo sea legible por quien audite después, no un «x». */
export const MIN_REASON_LENGTH = 10;

/**
 * ¿Se puede accionar sobre este despliegue?
 *
 * Sólo lo que está vivo. Revertir algo ya revertido, suspendido o sustituido no es un error del
 * usuario que convenga dejar que descubra con un 409: es una acción que no tiene sentido, y
 * ofrecerla sugiere que sí lo tiene.
 */
export function esAccionable(status: unknown): boolean {
  return status === 'ACTIVE' || status === 'PREPARING';
}
