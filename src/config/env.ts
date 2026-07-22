import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  apiBaseUrl: z.string().trim().default('/'),
  apiTimeoutMs: z.coerce.number().int().min(1_000).max(120_000).default(15_000),
});

function normalizeBaseUrl(value: string): string {
  return value === '/' ? '' : value.replace(/\/+$/, '');
}

/**
 * Validates browser-visible configuration without exposing server secrets.
 *
 * The portal intentionally uses same-origin requests. Next.js route handlers proxy
 * `/v1`, `/health` and `/metrics` to the Decision Engine.
 */
function readPublicEnvironment() {
  const parsed = publicEnvironmentSchema.safeParse({
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '/',
    apiTimeoutMs: process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 15_000,
  });

  if (!parsed.success) {
    throw new Error('La configuración pública del frontend es inválida.');
  }

  return {
    apiBaseUrl: normalizeBaseUrl(parsed.data.apiBaseUrl),
    apiTimeoutMs: parsed.data.apiTimeoutMs,
  } as const;
}

export const env = readPublicEnvironment();
