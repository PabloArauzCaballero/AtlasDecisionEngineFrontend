import { z } from 'zod';
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

export interface PasswordResetIdentity {
  tenantId: string;
  email: string;
}

/**
 * «¿Olvidaste tu contraseña?», paso uno. La respuesta es la misma exista o no la cuenta: el
 * motor sólo confirma que registró la solicitud, y el código llega al correo si la cuenta existe.
 */
export async function requestPasswordReset(identity: PasswordResetIdentity): Promise<void> {
  await publicApiRequest(sessionPath('password/reset/request'), {
    method: 'POST',
    body: identity,
    responseSchema: z.object({ requested: z.literal(true) }),
  });
}

/** Paso dos: el código del correo y la contraseña nueva. Cierra toda sesión previa de la cuenta. */
export async function confirmPasswordReset(
  input: PasswordResetIdentity & { code: string; newPassword: string },
): Promise<void> {
  await publicApiRequest(sessionPath('password/reset/confirm'), {
    method: 'POST',
    body: input,
    responseSchema: z.object({ passwordChanged: z.literal(true) }),
  });
}

let bootstrapPromise: Promise<SessionPayload> | null = null;

export function restoreSession(): Promise<SessionPayload> {
  bootstrapPromise ??= refresh().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}
