import { ApiError } from './ApiError';

type ErrorPayload = {
  message?: string;
  code?: string;
  error?: { message?: string; code?: string };
};

export async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
  let payload: ErrorPayload = {};
  try {
    payload = (await response.json()) as ErrorPayload;
  } catch {
    // The status code remains the source of truth when the body is not JSON.
  }
  const nested = payload.error;
  const fallback =
    response.status === 401
      ? 'Tu sesión venció. Inicia sesión nuevamente.'
      : response.status === 403
        ? 'No tienes permisos para realizar esta acción.'
        : 'No fue posible completar la solicitud.';
  throw new ApiError(
    nested?.message ?? payload.message ?? fallback,
    response.status,
    nested?.code ?? payload.code,
    response.headers.get('x-request-id') ?? undefined,
  );
}
