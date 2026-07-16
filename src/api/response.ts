import { z, type ZodType } from 'zod';
import { ApiError } from './ApiError';

const errorPayloadSchema = z
  .object({
    message: z.string().optional(),
    code: z.string().optional(),
    error: z
      .object({
        message: z.string().optional(),
        code: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

async function readJsonBody(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body.trim()) return undefined;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    if (response.ok) {
      throw new ApiError(
        'El servidor devolvió una respuesta incompatible.',
        502,
        'INVALID_RESPONSE_BODY',
        response.headers.get('x-request-id') ?? undefined,
        'contract',
      );
    }
    return undefined;
  }
}

/**
 * Parses an HTTP response and optionally validates its successful payload.
 *
 * External data remains `unknown` until the supplied Zod schema accepts it.
 */
export async function parseResponse<T>(
  response: Response,
  responseSchema?: ZodType<T>,
): Promise<T> {
  if (response.status === 204) return undefined as T;

  const payload = await readJsonBody(response);
  const requestId = response.headers.get('x-request-id') ?? undefined;

  if (response.ok) {
    if (!responseSchema) return payload as T;

    const validation = responseSchema.safeParse(payload);
    if (!validation.success) {
      throw new ApiError(
        'La respuesta del servidor no cumple el contrato esperado.',
        502,
        'RESPONSE_CONTRACT_MISMATCH',
        requestId,
        'contract',
      );
    }
    return validation.data;
  }

  const parsedError = errorPayloadSchema.safeParse(payload);
  const errorPayload = parsedError.success ? parsedError.data : {};
  const nested = errorPayload.error;
  const fallback =
    response.status === 401
      ? 'Tu sesión venció. Inicia sesión nuevamente.'
      : response.status === 403
        ? 'No tienes permisos para realizar esta acción.'
        : response.status === 404
          ? 'El recurso solicitado no existe.'
          : response.status === 409
            ? 'La operación entra en conflicto con el estado actual.'
            : response.status === 429
              ? 'Se alcanzó el límite de solicitudes. Intenta nuevamente en unos momentos.'
              : 'No fue posible completar la solicitud.';

  throw new ApiError(
    nested?.message ?? errorPayload.message ?? fallback,
    response.status,
    nested?.code ?? errorPayload.code,
    requestId,
  );
}
