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

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}
