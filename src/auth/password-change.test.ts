import { vi } from 'vitest';
import { passwordChangedSchema, pinChallengeSchema } from './auth.schemas';

vi.mock('../api/http-client', () => ({
  apiRequest: vi.fn(async () => ({ passwordChanged: true })),
  publicApiRequest: vi.fn(),
}));

const { apiRequest } = await import('../api/http-client');
const { confirmPasswordChange, requestPasswordChange } = await import('./auth.api');

/**
 * El cambio de contraseña del portal.
 *
 * Lo que se vigila aquí son las tres decisiones que no se ven leyendo la
 * pantalla: que las llamadas viajen AUTENTICADAS (el motor decide de quién es la
 * contraseña a partir del token, no del cuerpo), que la confirmación no reintente
 * tras un 401 —al completarse, el motor revoca toda sesión, y un reintento
 * repetiría la llamada con un desafío ya consumido—, y que un cuerpo que no
 * confirma el cambio no se dé por bueno.
 */
describe('cambio de contraseña desde el portal', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockClear();
  });

  it('pide el código mandando sólo la contraseña actual, y autenticado', async () => {
    await requestPasswordChange('la-actual');

    const [path, options] = vi.mocked(apiRequest).mock.calls.at(-1) ?? [];
    expect(path).toBe('/v1/session/password/change/request');
    expect(options?.body).toEqual({ currentPassword: 'la-actual' });
  });

  it('confirma sin reintentar tras un 401', async () => {
    const input = {
      challengeToken: 'desafio-opaco-1234567890',
      code: '123456',
      newPassword: 'NuevaClave#2026',
    };

    await confirmPasswordChange(input);

    const [path, options] = vi.mocked(apiRequest).mock.calls.at(-1) ?? [];
    expect(path).toBe('/v1/session/password/change/confirm');
    expect(options?.body).toEqual(input);
    expect(options?.retryOnUnauthorized).toBe(false);
  });

  it('no da por cambiada una contraseña si el cuerpo no lo dice', () => {
    expect(passwordChangedSchema.safeParse({ passwordChanged: true }).success).toBe(true);
    expect(passwordChangedSchema.safeParse({ passwordChanged: false }).success).toBe(false);
    expect(passwordChangedSchema.safeParse({}).success).toBe(false);
  });

  it('el desafío del cambio es el mismo contrato que el del acceso', () => {
    const challenge = {
      pinChallengeRequired: true,
      challengeToken: 'x'.repeat(24),
      expiresInMinutes: 10,
    };
    expect(pinChallengeSchema.safeParse(challenge).success).toBe(true);
    // Sin `challengeToken` no hay nada que canjear: rechazarlo aquí evita una
    // pantalla de PIN que nunca podría completarse.
    expect(pinChallengeSchema.safeParse({ ...challenge, challengeToken: '' }).success).toBe(false);
  });
});
