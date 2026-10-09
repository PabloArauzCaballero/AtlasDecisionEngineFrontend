/**
 * Qué sondas de salud del motor reenvía `/health/*` del portal.
 *
 * Era un comodín: cualquier `/health/…` llegaba al motor, y el motor contesta SIN sesión a
 * `health/data-sources` con sus conexiones (bases, caché, latencias) y reglas de enrutamiento.
 * Reconocimiento gratis para quien llegue al dominio del portal, el mismo caso que ya se cerró
 * en `/metrics`.
 *
 * Se abren sólo las que alguien usa: `/health/live` y `/health/ready` (la pantalla de estado de
 * la plataforma y el smoke post-despliegue) y `/health` a secas, la sonda clásica.
 */
const PUBLIC_HEALTH_PATHS = new Set(['', 'live', 'ready']);

export function isPublicHealthPath(segments: readonly string[]): boolean {
  if (segments.length > 1) return false;
  return PUBLIC_HEALTH_PATHS.has(segments[0] ?? '');
}
