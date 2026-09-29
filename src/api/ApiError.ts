export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limit'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'contract'
  | 'unexpected';

function classifyStatus(status: number): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 408) return 'timeout';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limit';
  if (status === 499) return 'cancelled';
  if (status === 502) return 'contract';
  return 'unexpected';
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    kind?: ApiErrorKind,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind ?? classifyStatus(status);
  }
}

/**
 * Qué decirle a la persona cuando el motor no dio un mensaje que se pueda enseñar tal cual.
 *
 * El motor responde unos errores en español pensados para la pantalla («No hay ningún caso de
 * revisión con ese identificador.») y otros en inglés escritos para quien programa («Artifact
 * version not found», «variables must be a JSON object»). Estos últimos se pintaban tal cual en
 * los avisos (medido en TEST el 2026-09-29). Por tipo de fallo se dice qué pasó y qué hacer.
 */
const PLAIN_BY_KIND: Record<ApiErrorKind, string> = {
  validation: 'Algún dato no es válido. Revisa lo que escribiste e inténtalo de nuevo.',
  unauthorized: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  forbidden: 'Tu usuario no tiene permiso para hacer esto. Pídeselo a un administrador.',
  'not-found': 'Lo que buscas ya no existe o fue movido. Actualiza la página.',
  conflict: 'Esto ya cambió mientras lo tenías abierto. Actualiza la página y vuelve a intentarlo.',
  'rate-limit': 'Se hicieron demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.',
  network: 'No hay conexión con el motor. Revisa tu conexión y vuelve a intentarlo.',
  timeout: 'El motor tardó demasiado en responder. Vuelve a intentarlo en unos minutos.',
  cancelled: 'La operación se canceló.',
  contract: 'El motor respondió algo que esta pantalla no entiende. Avisa a soporte.',
  unexpected:
    'No se pudo completar la operación. Vuelve a intentarlo; si se repite, avisa a soporte.',
};

const SPANISH_HINT =
  /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|que|no|un|una|para|es|con|hay|se|por|sin|ya|esta|este)\b/i;
const TECHNICAL_HINT = /`|\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b|\{|\}|\/v\d\//;

/** El mensaje del motor si es español llano; si no, la explicación por tipo de fallo. */
export function plainMessage(error: ApiError): string {
  const message = error.message.trim();
  if (message && SPANISH_HINT.test(message) && !TECHNICAL_HINT.test(message)) return message;
  return PLAIN_BY_KIND[error.kind];
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return plainMessage(error);
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}
