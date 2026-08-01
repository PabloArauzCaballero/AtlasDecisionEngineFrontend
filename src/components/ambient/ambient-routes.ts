import type { AmbientVariant } from '../AmbientBackground';

/**
 * Fondo ambiental que corresponde a cada zona del portal.
 *
 * Se resuelve por ruta y no página por página: así toda vista nueva hereda el
 * fondo de su familia sin tocar su código, y ninguna se queda con el aspecto
 * plano de antes por olvido. El prefijo más largo gana, de modo que una vista
 * de detalle puede pedir un fondo distinto al de su listado.
 */
const ROUTE_VARIANTS: ReadonlyArray<readonly [string, AmbientVariant]> = [
  ['/platform-health', 'dashboard'],
  ['/graph-editor', 'editor'],
  ['/code-import', 'editor'],
  ['/artifact-versions', 'editor'],
  ['/artifacts', 'editor'],
  ['/algorithms', 'editor'],
  ['/variables', 'editor'],
  ['/reason-codes', 'editor'],
  ['/test-suites', 'lab'],
  ['/test-cases', 'lab'],
  ['/test-runs', 'lab'],
  ['/graph-coverage', 'lab'],
  ['/coverage-matrix', 'lab'],
  ['/simulator', 'lab'],
  ['/live-execution', 'lab'],
  ['/environments', 'deploy'],
  ['/deployments', 'deploy'],
  ['/reviews', 'deploy'],
  ['/approval-requests', 'deploy'],
  ['/security-review', 'deploy'],
  ['/executions', 'results'],
  ['/audit-events', 'results'],
  ['/manual-reviews', 'results'],
  ['/objectives', 'results'],
  ['/search', 'results'],
];

export function ambientVariantFor(pathname: string): AmbientVariant {
  let best: AmbientVariant = 'dashboard';
  let bestLength = -1;
  for (const [prefix, variant] of ROUTE_VARIANTS) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && prefix.length > bestLength) {
      best = variant;
      bestLength = prefix.length;
    }
  }
  return best;
}
