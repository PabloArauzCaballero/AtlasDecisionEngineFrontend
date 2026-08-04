/**
 * Claves de idempotencia para las acciones administrativas.
 *
 * Aprobar, rechazar o desplegar no son operaciones repetibles: un reintento tras
 * un timeout —o un doble clic sobre un botón que ya viajaba— puede registrar dos
 * decisiones sobre el mismo paso. La clave viaja en `Idempotency-Key` y se
 * mantiene estable mientras sea *el mismo intento*, de modo que el backend pueda
 * reconocer el duplicado; se renueva sólo cuando el usuario empieza una decisión
 * distinta.
 *
 * El portal no puede garantizar la idempotencia por sí solo: si el backend
 * ignora la cabecera, el reintento se duplica igual. Enviarla es la mitad del
 * contrato que sí depende de este lado.
 */

const HEADER = 'Idempotency-Key';

/** Identificador único por intento. `randomUUID` con respaldo para entornos sin él. */
export function newIdempotencyKey(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${uuid}`;
}

/** Cabecera lista para pasar a `apiRequest`. */
export function idempotencyHeaders(key: string): Record<string, string> {
  return { [HEADER]: key };
}
