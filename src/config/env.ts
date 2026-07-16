function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed === '/' ? '' : trimmed.replace(/\/+$/, '');
}

export const env = {
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '/'),
} as const;
