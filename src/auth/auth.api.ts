import { publicApiRequest } from '../api/http-client';
import { loginOutcomeSchema, sessionPayloadSchema } from './auth.schemas';
import type { LoginInput, LoginOutcome, LoginPinInput, SessionPayload } from './auth.types';

const sessionPath = (operation: string) => `/v1/session/${operation}`;

function sessionRequest(operation: string, body: unknown): Promise<SessionPayload> {
  return publicApiRequest(sessionPath(operation), {
    method: 'POST',
    body,
    responseSchema: sessionPayloadSchema,
  });
}

/** Primer paso. Puede terminar en sesión o en desafío de segundo factor; ambos son un éxito. */
export function login(input: LoginInput): Promise<LoginOutcome> {
  return publicApiRequest(sessionPath('login'), {
    method: 'POST',
    body: input,
    responseSchema: loginOutcomeSchema,
  });
}

/** Segundo paso: el token del desafío y el PIN del correo, a cambio de la sesión. */
export function verifyLoginPin(input: LoginPinInput): Promise<SessionPayload> {
  return sessionRequest('login/pin', input);
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
