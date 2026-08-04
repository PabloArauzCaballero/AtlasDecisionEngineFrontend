/**
 * La matriz responsive del portal: qué rutas y a qué anchos.
 *
 * Vive aparte porque la comparten el generador de evidencia
 * (`responsive-audit.spec.ts`, que mide y no afirma) y la prueba que sí afirma
 * (`responsive.spec.ts`). Con dos listas separadas la prueba acababa cubriendo
 * un subconjunto distinto del que se auditó, que es como no auditar.
 */

/**
 * Anchos de la matriz obligatoria. No son «modelos de teléfono»: son los puntos
 * donde el contenido de este portal se reorganiza, más los extremos.
 *
 * 320 es el suelo real (el `min-width` del `body`); 2560 comprueba que el
 * contenido se centra en vez de estirarse hasta perder la línea de lectura.
 */
export const AUDIT_WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920, 2560] as const;

/**
 * Los tres anchos que sí bloquean la entrega. La suite corre con un worker
 * contra un servidor, así que la matriz entera (10 anchos × 40 rutas) dura
 * demasiado para el ciclo normal; estos tres cubren las tres organizaciones
 * distintas del marco —cajón, tableta y escritorio— y son donde han aparecido
 * todos los defectos reales. La matriz completa está en las herramientas.
 */
export const GATE_WIDTHS = [320, 768, 1280] as const;

/**
 * Rutas del portal con vista propia. Se listan a mano y no se derivan del árbol
 * de páginas a propósito: las rutas con parámetro necesitan un identificador
 * que el motor simulado reconozca, y ese dato no está en el nombre del fichero.
 */
export const AUDIT_ROUTES = [
  // `/` es una redirección de servidor a `/login`, no una vista: se mide el
  // destino. Medir la redirección sólo aborta la navegación siguiente.
  '/login',
  '/platform-health',
  '/search',
  '/variables',
  '/variables/1',
  '/calculated-fields',
  '/calculated-fields/1',
  '/reason-codes',
  '/artifacts',
  '/artifacts/1',
  '/artifacts/1/dependency-graph',
  '/algorithms',
  '/actions',
  '/code-import',
  '/graph-editor',
  '/artifact-versions/1/graph',
  '/artifact-versions/1/compile',
  '/artifact-versions/1/test-suites',
  '/libraries',
  '/qa-lab',
  '/test-suites',
  '/test-suites/1/cases',
  '/test-cases',
  '/test-runs/1',
  '/test-runs/1/coverage',
  '/graph-coverage',
  '/coverage-matrix',
  '/objectives',
  '/objectives/1',
  '/reviews',
  '/approval-requests/1',
  '/security-review/1',
  '/environments',
  '/deployments',
  '/simulator',
  '/live-execution',
  '/manual-reviews',
  '/manual-reviews/1',
  '/executions',
  '/executions/1',
  '/audit-events',
] as const;

/**
 * Subconjunto que bloquea la entrega: una vista de cada familia estructural
 * —tabla densa, detalle en dos columnas, editor, asistente, panel— más las que
 * han roto antes. Cubrir las 41 en cada corrida multiplicaría por tres el reloj
 * sin cubrir una organización nueva.
 */
export const GATE_ROUTES = [
  '/login',
  '/variables',
  '/calculated-fields',
  '/actions',
  '/graph-editor',
  '/test-cases',
  '/test-suites',
  '/executions/1',
  '/simulator',
  '/manual-reviews/1',
  '/audit-events',
  '/platform-health',
] as const;
