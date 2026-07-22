import type { ZodType, ZodTypeDef } from 'zod';
import { env } from '../config/env';
import { ApiError } from './ApiError';
import { createRequestSignal } from './request-signal';
import { parseResponse } from './response';

type ClientSession = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string>;
  expireSession: () => void;
};

let session: ClientSession | null = null;

export function configureHttpClient(value: ClientSession): () => void {
  session = value;
  return () => {
    if (session === value) session = null;
  };
}

export interface PublicApiRequestOptions<TResponse = unknown> extends Omit<
  RequestInit,
  'body' | 'signal'
> {
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  responseSchema?: ZodType<TResponse, ZodTypeDef, unknown>;
}

export interface ApiRequestOptions<TResponse = unknown> extends PublicApiRequestOptions<TResponse> {
  retryOnUnauthorized?: boolean;
}

function assertSafeApiPath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new ApiError(
      'La ruta de API no es válida.',
      400,
      'INVALID_API_PATH',
      undefined,
      'validation',
    );
  }
}

/**
 * Sends a same-origin request that does not require an access token.
 *
 * This is reserved for session bootstrap, login, refresh and logout flows.
 */
export async function publicApiRequest<T>(
  path: string,
  options: PublicApiRequestOptions<T> = {},
): Promise<T> {
  assertSafeApiPath(path);
  const response = await send(path, options);
  return parseResponse(response, options.responseSchema);
}

/**
 * Sends an authenticated API request and performs at most one token refresh.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions<T> = {}): Promise<T> {
  assertSafeApiPath(path);
  const activeSession = session;
  const token = activeSession?.getAccessToken();

  if (!activeSession || !token) {
    activeSession?.expireSession();
    throw new ApiError('No existe una sesión activa.', 401, 'UNAUTHORIZED');
  }

  const response = await send(path, options, token);
  if (response.status !== 401 || options.retryOnUnauthorized === false) {
    return parseResponse(response, options.responseSchema);
  }

  let refreshedToken: string;
  try {
    refreshedToken = await activeSession.refreshAccessToken();
  } catch (error) {
    activeSession.expireSession();
    throw error;
  }

  const retryResponse = await send(
    path,
    { ...options, retryOnUnauthorized: false },
    refreshedToken,
  );

  if (retryResponse.status === 401) {
    activeSession.expireSession();
  }

  return parseResponse(retryResponse, options.responseSchema);
}

export interface ApiEvent {
  type: string;
  data: unknown;
}

/**
 * Fase 8 — live execution. Reads a `text/event-stream` response incrementally
 * (fetch + ReadableStream, not the browser's native EventSource) specifically so
 * the request goes through the same Authorization-header auth as every other
 * apiRequest call — EventSource cannot send custom headers, and this app has no
 * cookie-based session to fall back on. Resolves once the server closes the
 * stream (this app's SSE endpoints always complete; they are not open-ended).
 */
export async function apiEventStream(
  path: string,
  onEvent: (event: ApiEvent) => void,
  options: ApiRequestOptions = {},
): Promise<void> {
  assertSafeApiPath(path);
  const activeSession = session;
  const token = activeSession?.getAccessToken();
  if (!activeSession || !token) {
    activeSession?.expireSession();
    throw new ApiError('No existe una sesión activa.', 401, 'UNAUTHORIZED');
  }

  const response = await send(path, options, token);
  if (!response.ok || !response.body) {
    return parseResponse(response, options.responseSchema).then(() => undefined);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const type = /^event: (.+)$/m.exec(frame)?.[1] ?? 'message';
      const dataLine = /^data: (.+)$/m.exec(frame)?.[1];
      if (dataLine !== undefined) {
        try {
          onEvent({ type, data: JSON.parse(dataLine) });
        } catch {
          // A malformed frame must not kill the whole stream — skip it.
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}

async function send<T>(
  path: string,
  options: ApiRequestOptions<T>,
  token?: string,
): Promise<Response> {
  const {
    body,
    responseSchema,
    retryOnUnauthorized,
    signal: externalSignal,
    timeoutMs = env.apiTimeoutMs,
    ...requestInit
  } = options;
  void responseSchema;
  void retryOnUnauthorized;

  const headers = new Headers(requestInit.headers);
  headers.set('accept', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const managedSignal = createRequestSignal(externalSignal, timeoutMs);

  try {
    return await fetch(`${env.apiBaseUrl}${path}`, {
      ...requestInit,
      credentials: 'include',
      headers,
      signal: managedSignal.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    if (managedSignal.didTimeout()) {
      throw new ApiError(
        'La solicitud excedió el tiempo máximo de espera.',
        408,
        'REQUEST_TIMEOUT',
        undefined,
        'timeout',
      );
    }

    if (externalSignal?.aborted) {
      throw new ApiError(
        'La solicitud fue cancelada.',
        499,
        'REQUEST_ABORTED',
        undefined,
        'cancelled',
      );
    }

    throw new ApiError(
      'No fue posible conectar con el servidor.',
      0,
      'NETWORK_ERROR',
      undefined,
      'network',
    );
  } finally {
    managedSignal.cleanup();
  }
}
