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

  /** Emite un marco completo. Uno mal formado se salta, no tumba el flujo. */
  const emit = (frame: string) => {
    const type = /^event: (.+)$/m.exec(frame)?.[1] ?? 'message';
    const dataLine = /^data: (.+)$/m.exec(frame)?.[1];
    if (dataLine === undefined) return;
    try {
      onEvent({ type, data: JSON.parse(dataLine) });
    } catch {
      // A malformed frame must not kill the whole stream — skip it.
    }
  };

  /*
   * Cancelar en cuanto llega la señal, sin esperar al siguiente fragmento.
   *
   * No basta con pasársela a `fetch`: para cuando llega la respuesta, la lectura
   * del cuerpo ya es asunto aparte, y un `read()` pendiente sobre una ejecución
   * que aún no ha terminado se quedaría esperando para siempre. Atarlo aquí,
   * además, no depende de qué haga cada implementación de `fetch` con la señal.
   */
  const onAbort = () => void reader.cancel().catch(() => undefined);
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        emit(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
      }
    }
    // Un servidor que cierra sin la línea en blanco final dejaba su último
    // evento —normalmente el `execution_completed`— sin entregar.
    if (buffer.trim()) emit(buffer);
  } catch (error) {
    // Cancelar es una forma normal de terminar: quien abandona la página o
    // lanza otra ejecución no está viendo un fallo, y tratarlo como tal le
    // pintaría un error rojo por haber hecho lo correcto.
    if (!options.signal?.aborted) throw error;
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    /*
     * Cierra la conexión de verdad. Sin esto, el cuerpo sigue llegando aunque
     * nadie lo lea: pedir una segunda ejecución dejaba la primera drenando
     * contra el motor, y salir de la página no cerraba ninguna.
     */
    await reader.cancel().catch(() => undefined);
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
