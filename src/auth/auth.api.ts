import { apiRequest, publicApiRequest } from '../api/http-client';
import {
  loginOutcomeSchema,
  passwordChangedSchema,
  pinChallengeSchema,
  sessionPayloadSchema,
} from './auth.schemas';
import type {
  LoginInput,
  LoginOutcome,
  LoginPinInput,
  PasswordChangeInput,
  PasswordChanged,
  PinChallenge,
  SessionPayload,
} from './auth.types';

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

/**
 * Primer paso del cambio de contraseña de quien ya está dentro: valida la
 * contraseña actual y manda un código al correo de la cuenta. Devuelve el mismo
 * desafío que el segundo factor del acceso, así que la pantalla reutiliza la
 * forma que ya conoce en vez de aprender un contrato nuevo para lo mismo.
 */
export function requestPasswordChange(currentPassword: string): Promise<PinChallenge> {
  // `apiRequest` y no `publicApiRequest`: aquí SÍ hace falta el token, porque el
  // motor decide de quién es la contraseña a partir de él y no del cuerpo.
  return apiRequest(sessionPath('password/change/request'), {
    method: 'POST',
    body: { currentPassword },
    responseSchema: pinChallengeSchema,
  });
}

/** Segundo paso. Al completarse, TODA sesión de la cuenta queda revocada. */
export function confirmPasswordChange(input: PasswordChangeInput): Promise<PasswordChanged> {
  return apiRequest(sessionPath('password/change/confirm'), {
    method: 'POST',
    body: input,
    responseSchema: passwordChangedSchema,
    // Sin reintento por 401: al confirmarse, el motor revoca TODA sesión de la
    // cuenta. Renovar el token aquí sólo repetiría la llamada con un desafío ya
    // consumido y convertiría un cambio exitoso en un error.
    retryOnUnauthorized: false,
  });
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
