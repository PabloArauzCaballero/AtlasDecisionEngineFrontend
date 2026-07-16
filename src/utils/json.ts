export function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El valor debe ser un objeto JSON.');
  }
  return parsed as Record<string, unknown>;
}
