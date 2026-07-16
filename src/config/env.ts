function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed === '/' ? '' : trimmed.replace(/\/+$/, '');
}

/**
 * Returns the browser-visible API base URL.
 *
 * The portal intentionally uses same-origin requests. Next.js rewrites proxy
 * `/v1`, `/health` and `/metrics` to the Decision Engine without exposing its
 * internal address to the browser bundle.
 */
function readPublicApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? '/');
}

export const env = {
  apiBaseUrl: readPublicApiBaseUrl(),
} as const;
