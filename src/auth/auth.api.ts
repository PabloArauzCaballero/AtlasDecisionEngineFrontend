import { publicApiRequest } from '../api/http-client';
import { sessionPayloadSchema } from './auth.schemas';
import type { LoginInput, SessionPayload } from './auth.types';

const sessionPath = (operation: string) => `/v1/session/${operation}`;

function sessionRequest(operation: string, body: unknown): Promise<SessionPayload> {
  return publicApiRequest(sessionPath(operation), {
    method: 'POST',
    body,
    responseSchema: sessionPayloadSchema,
  });
}

export function login(input: LoginInput): Promise<SessionPayload> {
  return sessionRequest('login', input);
}

export function refresh(): Promise<SessionPayload> {
  return sessionRequest('refresh', {});
}

export async function logout(allDevices = false): Promise<void> {
  await publicApiRequest<void>(sessionPath('logout'), {
    method: 'POST',
    body: { allDevices },
  });
}

let bootstrapPromise: Promise<SessionPayload> | null = null;

export function restoreSession(): Promise<SessionPayload> {
  bootstrapPromise ??= refresh().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}
