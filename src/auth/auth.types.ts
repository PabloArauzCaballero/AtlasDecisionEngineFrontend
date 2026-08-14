import type { z } from 'zod';
import type { identityUserSchema, pinChallengeSchema, sessionPayloadSchema } from './auth.schemas';

/*
 * Los tipos se derivan del esquema en vez de declararse a mano.
 *
 * Escritos por separado, las dos mitades se desincronizaban en silencio: el
 * esquema podía volver un campo opcional y el tipo seguía prometiéndolo
 * obligatorio, con lo que TypeScript dejaba escribir `user.jobTitle.trim()`
 * sobre algo que en ejecución podía ser nulo.
 */
export type IdentityUser = z.infer<typeof identityUserSchema>;
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
export type PinChallenge = z.infer<typeof pinChallengeSchema>;

/** Lo que puede devolver el primer paso: una sesión, o la petición del segundo factor. */
export type LoginOutcome = SessionPayload | PinChallenge;

export function isPinChallenge(outcome: LoginOutcome): outcome is PinChallenge {
  return 'pinChallengeRequired' in outcome;
}

export interface LoginInput {
  tenantId: string;
  email: string;
  password: string;
}

export interface LoginPinInput {
  challengeToken: string;
  pin: string;
}
