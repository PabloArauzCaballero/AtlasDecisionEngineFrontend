import { env } from '../config/env';
import { ApiError } from './ApiError';
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

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  retryOnUnauthorized?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const activeSession = session;
  const token = activeSession?.getAccessToken();
  if (!activeSession || !token) {
    activeSession?.expireSession();
    throw new ApiError('No existe una sesión activa.', 401, 'UNAUTHORIZED');
  }
  const response = await send(path, options, token);
  if (response.status !== 401 || options.retryOnUnauthorized === false)
    return parseResponse<T>(response);
  try {
    const refreshedToken = await activeSession.refreshAccessToken();
    return parseResponse<T>(
      await send(path, { ...options, retryOnUnauthorized: false }, refreshedToken),
    );
  } catch (error) {
    activeSession.expireSession();
    throw error;
  }
}

function send(path: string, options: ApiRequestOptions, token: string): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('accept', 'application/json');
  headers.set('authorization', `Bearer ${token}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  return fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
