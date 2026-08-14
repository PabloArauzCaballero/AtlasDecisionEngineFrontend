import { identityUserSchema, loginOutcomeSchema, sessionPayloadSchema } from './auth.schemas';
import { isPinChallenge } from './auth.types';

/**
 * Un campo que el portal NO lee no puede dejar fuera a toda la organización.
 *
 * `parseResponse` convierte cualquier desajuste de esquema en
 * `RESPONSE_CONTRACT_MISMATCH`, y `restoreSession` lee ese fallo como sesión
 * inválida. Con las trece propiedades obligatorias, que el proveedor de
 * identidad dejase de mandar `permissions` —que nadie consume— bastaba para que
 * nadie pudiera entrar, culpando además al backend en el mensaje.
 */

const MINIMO = {
  accessToken: 'a.b.c',
  user: {
    id: 'u-1',
    tenantId: '1',
    email: 'ana@atlas.test',
    roles: ['PLATFORM_ADMIN'],
  },
};

describe('contrato de sesión', () => {
  it('acepta la carga mínima: identidad, correo, roles y token', () => {
    const parsed = sessionPayloadSchema.parse(MINIMO);
    expect(parsed.user.id).toBe('u-1');
    expect(parsed.user.roles).toEqual(['PLATFORM_ADMIN']);
    // Lo ausente se rellena, no revienta.
    expect(parsed.user.legacyRoles).toEqual([]);
    expect(parsed.user.permissions).toEqual([]);
    // Tres estados: ausente NO significa «no lo tiene», significa «no informa».
    expect(parsed.user.mustChangePassword).toBeUndefined();
    expect(parsed.tokenType).toBe('Bearer');
  });

  it('no cierra la puerta por el esquema de token en minúscula (RFC 6750)', () => {
    expect(sessionPayloadSchema.parse({ ...MINIMO, tokenType: 'bearer' }).tokenType).toBe('Bearer');
    expect(sessionPayloadSchema.parse({ ...MINIMO, tokenType: undefined }).tokenType).toBe(
      'Bearer',
    );
  });

  it('admite expiresIn como número o como texto', () => {
    expect(sessionPayloadSchema.safeParse({ ...MINIMO, expiresIn: 900 }).success).toBe(true);
    expect(sessionPayloadSchema.safeParse({ ...MINIMO, expiresIn: '900' }).success).toBe(true);
  });

  it('tolera nulos donde el proveedor no tiene dato', () => {
    const parsed = identityUserSchema.parse({
      ...MINIMO.user,
      userCode: null,
      department: null,
      jobTitle: null,
      legacyRoles: null,
      mfaEnabled: null,
    });
    expect(parsed.legacyRoles).toEqual([]);
    expect(parsed.jobTitle).toBeNull();
  });

  it('sigue rechazando lo que SÍ sostiene la sesión', () => {
    expect(sessionPayloadSchema.safeParse({ ...MINIMO, accessToken: '' }).success).toBe(false);
    expect(identityUserSchema.safeParse({ ...MINIMO.user, id: '' }).success).toBe(false);
    expect(identityUserSchema.safeParse({ ...MINIMO.user, email: 'no-es-correo' }).success).toBe(
      false,
    );
    // Un tipo equivocado no se «arregla»: eso escondería un contrato roto.
    expect(identityUserSchema.safeParse({ ...MINIMO.user, roles: 'ADMIN' }).success).toBe(false);
  });
});

/**
 * El primer paso tiene DOS desenlaces buenos, y confundirlos rompe el acceso en un sentido u otro:
 * leer un desafío como sesión deja el portal creyéndose autenticado sin token, y leer una sesión
 * como desafío pide un PIN que nadie mandó.
 */
describe('desenlace del primer paso', () => {
  const DESAFIO = {
    pinChallengeRequired: true,
    challengeToken: 'token-opaco',
    expiresInMinutes: 10,
  };

  it('reconoce el desafío de segundo factor', () => {
    const parsed = loginOutcomeSchema.parse(DESAFIO);
    expect(isPinChallenge(parsed)).toBe(true);
  });

  it('reconoce la sesión, que no lleva marca de desafío', () => {
    const parsed = loginOutcomeSchema.parse(MINIMO);
    expect(isPinChallenge(parsed)).toBe(false);
    if (isPinChallenge(parsed)) throw new Error('inalcanzable');
    expect(parsed.accessToken).toBe('a.b.c');
  });

  it('un desafío a medias no pasa por ninguno de los dos', () => {
    expect(loginOutcomeSchema.safeParse({ pinChallengeRequired: true }).success).toBe(false);
    expect(loginOutcomeSchema.safeParse({ ...DESAFIO, challengeToken: '' }).success).toBe(false);
  });
});
