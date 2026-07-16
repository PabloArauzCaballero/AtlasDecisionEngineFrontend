import { env } from '../config/env';
import { parseResponse } from '../api/response';
import type { LoginInput, SessionPayload } from './auth.types';

const sessionUrl = (path: string) => `${env.apiBaseUrl}/v1/session/${path}`;

async function sessionRequest(path: string, init: RequestInit): Promise<SessionPayload> {
  const response = await fetch(sessionUrl(path), {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  return parseResponse<SessionPayload>(response);
}

export function login(input: LoginInput): Promise<SessionPayload> {
  return sessionRequest('login', { method: 'POST', body: JSON.stringify(input) });
}

export function refresh(): Promise<SessionPayload> {
  return sessionRequest('refresh', { method: 'POST', body: '{}' });
}

export async function logout(allDevices = false): Promise<void> {
  const response = await fetch(sessionUrl('logout'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ allDevices }),
  });
  await parseResponse(response);
}

let bootstrapPromise: Promise<SessionPayload> | null = null;

export function restoreSession(): Promise<SessionPayload> {
  bootstrapPromise ??= refresh().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}
