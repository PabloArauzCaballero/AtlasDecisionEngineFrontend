import { ApiError } from '../../api/ApiError';

/** A quién se le pide el dato que falta. */
export const INFORMATION_SOURCES = [
  {
    value: 'CORE_BACKEND',
    label: 'Backend central',
    help: 'Datos que el motor no capturó en la ejecución: histórico de la cuenta, posiciones, movimientos.',
  },
  {
    value: 'CUSTOMER',
    label: 'Cliente',
    help: 'Documentación o aclaraciones que sólo el titular puede aportar.',
  },
  {
    value: 'INTERNAL',
    label: 'Equipo interno',
    help: 'Contexto de operaciones, fraude o cumplimiento sobre este caso.',
  },
] as const;

export type InformationSource = (typeof INFORMATION_SOURCES)[number]['value'];

export interface InformationRequestDraft {
  source: InformationSource | '';
  question: string;
}

export function informationRequestPath(caseId: string): string {
  return `/v1/manual-reviews/${encodeURIComponent(caseId)}/information-requests`;
}

export function isInformationRequestReady(draft: InformationRequestDraft): boolean {
  return draft.source !== '' && draft.question.trim().length >= 10;
}

/**
 * Traduce el fallo a algo accionable.
 *
 * El caso importante es el 404: este endpoint es un contrato ACORDADO que el
 * Decision Engine puede no haber desplegado todavía. Un «no encontrado» crudo
 * haría pensar que el caso no existe, cuando lo que no existe es la ruta. Se
 * distingue, y se dice qué falta, en vez de dejar al analista adivinando.
 */
export function informationRequestError(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'not-found') {
    return 'El motor todavía no expone la petición de información para casos. Escala el caso o solicita el dato por el canal habitual mientras el backend publica el endpoint.';
  }
  if (error instanceof ApiError && error.kind === 'forbidden') {
    return 'Tu rol no puede pedir información sobre este caso.';
  }
  return error instanceof Error ? error.message : 'No fue posible registrar la solicitud.';
}
