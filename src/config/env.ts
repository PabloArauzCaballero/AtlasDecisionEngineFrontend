import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  apiBaseUrl: z.string().trim().default('/'),
  apiTimeoutMs: z.coerce.number().int().min(1_000).max(120_000).default(15_000),
  /**
   * Ambiente en el que corre este frontend (DEV, TEST, PRODUCTION…). Se
   * muestra en el acceso cuando no es producción, para que nadie confunda un
   * entorno de pruebas con el real. Vacío = sin declarar, no se muestra nada.
   */
  environmentLabel: z.string().trim().toUpperCase().default(''),
  /**
   * Cuánto espera la pantalla por una glosa YA EN CURSO antes de darla por
   * enviada a revisión y devolver la interfaz.
   *
   * Vive aquí y no dentro del componente a propósito: cuánto es «demasiado»
   * depende de la máquina, del proveedor y de la carga del día, y eso lo decide
   * quien opera el portal — no se despliega para cambiarlo. El valor de serie es
   * un punto de partida y debe ajustarse midiendo la latencia real.
   */
  glossReviewTimeoutMs: z.coerce.number().int().min(1_000).max(600_000).default(20_000),
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
    environmentLabel: process.env.NEXT_PUBLIC_ENVIRONMENT ?? '',
    glossReviewTimeoutMs: process.env.NEXT_PUBLIC_GLOSS_REVIEW_TIMEOUT_MS ?? 20_000,
  });

  if (!parsed.success) {
    throw new Error('La configuración pública del frontend es inválida.');
  }

  return {
    apiBaseUrl: normalizeBaseUrl(parsed.data.apiBaseUrl),
    apiTimeoutMs: parsed.data.apiTimeoutMs,
    environmentLabel: parsed.data.environmentLabel,
    glossReviewTimeoutMs: parsed.data.glossReviewTimeoutMs,
  } as const;
}

export const env = readPublicEnvironment();
