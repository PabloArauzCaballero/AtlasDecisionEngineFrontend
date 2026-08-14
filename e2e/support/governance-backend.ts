import type { Page } from '@playwright/test';
import { EMPTY_PAGE, MOCK_SESSION } from './backend-mock';

/**
 * Motor simulado con datos de gobierno.
 *
 * El motor simulado normal devuelve listados VACÍOS y el denso devuelve páginas
 * de filas: ninguno de los dos sirve para las pantallas de gobierno, que leen
 * OBJETOS de detalle (una solicitud con sus pasos, un artefacto con sus
 * versiones, dos grafos que comparar). Contra ellos, el detalle de aprobación
 * pinta su cabecera y nada más, y una prueba escrita así mediría el vacío
 * creyendo que mide la vista.
 *
 * Aquí llega el escenario completo y a propósito incómodo:
 *
 * - Un paso pendiente que el usuario simulado SÍ puede firmar.
 * - Gates con un resultado en rojo, para que la insignia no aprobada se pinte.
 * - Dos despliegues ACTIVE en PROD: la invariante rota que el portal señala.
 * - Un origen (v54) distinto de lo vigente en PROD (v60): el aviso de base
 *   desactualizada.
 * - Dos grafos que difieren en alta, baja y modificación, para que el diff
 *   tenga las tres clases de fila.
 */

const ARTIFACT = {
  id: '1',
  name: 'Scoring de crédito de consumo',
  artifactCode: 'SCORING_CREDITO_CONSUMO',
  artifactType: 'DECISION_TREE',
  ownerTeam: 'Riesgo de Crédito y Cobranzas',
  riskDomain: 'CREDITO',
  createdAt: '2026-07-01T10:00:00Z',
  isActive: true,
};

const VERSION = {
  id: '55',
  versionNumber: '5',
  semanticVersion: '1.5.0',
  sourceVersionId: '54',
  checksum: 'sha256:9f2c4e7a1b8d0356fa41c9e7b25d8043',
  status: 'IN_REVIEW',
  createdAt: '2026-07-28T09:00:00Z',
  artifact: ARTIFACT,
};

const APPROVAL_REQUEST = {
  id: '31',
  status: 'IN_REVIEW',
  workflowCode: 'STANDARD_RISK',
  // Distinto del usuario simulado: si coincidiera, la separación de funciones
  // bloquearía la decisión y el diálogo de confirmación nunca se mediría.
  requestedBy: 'autora.version@atlas.bo',
  dueAt: '2026-08-10T17:00:00Z',
  createdAt: '2026-07-28T09:30:00Z',
  artifactVersion: VERSION,
  gates: [
    { id: 'compile', name: 'Compilación determinista', status: 'PASSED' },
    { id: 'suite', name: 'Suite bloqueante', status: 'FAILED', detail: '2 casos en rojo' },
    { id: 'coverage', name: 'Cobertura mínima', status: 'PASSED' },
  ],
  steps: [
    { id: '10', stepOrder: 1, requiredRole: 'QA_ANALYST', status: 'APPROVED' },
    { id: '11', stepOrder: 2, requiredRole: 'RISK_APPROVER', status: 'PENDING' },
    { id: '12', stepOrder: 3, requiredRole: 'COMPLIANCE', status: 'PENDING' },
  ],
};

/** Dos activos en PROD a la vez: la invariante que el portal debe delatar. */
const DEPLOYMENTS = {
  items: [
    {
      id: 'dep-1',
      environment: { code: 'PROD' },
      deploymentStatus: 'ACTIVE',
      deploymentMode: 'DIRECT',
      deployedAt: '2026-07-25T12:00:00Z',
      deployedBy: 'plataforma@atlas.bo',
      artifactVersion: { id: '60', versionNumber: '6', semanticVersion: '1.6.0' },
    },
    {
      id: 'dep-2',
      environment: { code: 'PROD' },
      deploymentStatus: 'ACTIVE',
      deploymentMode: 'CANARY',
      deployedAt: '2026-07-20T12:00:00Z',
      deployedBy: 'plataforma@atlas.bo',
      artifactVersion: { id: '58', versionNumber: '5.8', semanticVersion: '1.5.8' },
    },
    {
      id: 'dep-3',
      environment: { code: 'DEV' },
      deploymentStatus: 'ACTIVE',
      deployedAt: '2026-07-28T12:00:00Z',
      deployedBy: 'riesgo@atlas.bo',
      artifactVersion: { id: '55', versionNumber: '5', semanticVersion: '1.5.0' },
    },
  ],
  page: 1,
  pageSize: 50,
  total: 3,
  totalPages: 1,
  hasNextPage: false,
};

const BASE_GRAPH = {
  nodes: [
    { key: 'INICIO', type: 'START', label: 'Inicio', x: 10, y: 10 },
    { key: 'EVAL_SCORE', type: 'CONDITION', label: 'Evalúa score de buró', config: { min: 550 } },
    { key: 'RECHAZO', type: 'RESULT', label: 'Rechazar por score', terminal: true },
  ],
  edges: [{ key: 'E1', from: 'INICIO', to: 'EVAL_SCORE', priority: 1 }],
  variables: [{ code: 'ingreso_mensual', usageType: 'INPUT', required: true }],
};

const TARGET_GRAPH = {
  nodes: [
    { key: 'INICIO', type: 'START', label: 'Inicio', x: 40, y: 10 },
    {
      key: 'EVAL_SCORE',
      type: 'CONDITION',
      label: 'Evalúa score y capacidad',
      config: { min: 600 },
    },
    { key: 'REVISION', type: 'RESULT', label: 'Enviar a revisión manual', terminal: true },
  ],
  edges: [{ key: 'E1', from: 'INICIO', to: 'REVISION', priority: 1 }],
  variables: [{ code: 'ingreso_mensual', usageType: 'INPUT', required: false }],
};

/**
 * Intercepta el backend con el escenario de gobierno.
 *
 * Se registra DESPUÉS de `mockBackend` cuando ambos se usan: Playwright da
 * prioridad a la última ruta declarada.
 */
export async function governanceBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('unread-count')) return route.fulfill({ json: { unread: 0 } });
    if (url.includes('/v1/approval-requests/')) return route.fulfill({ json: APPROVAL_REQUEST });
    if (url.includes('/v1/deployments')) return route.fulfill({ json: DEPLOYMENTS });
    if (url.includes('/artifact-versions/54/graph')) return route.fulfill({ json: BASE_GRAPH });
    if (url.includes('/artifact-versions/60/graph')) return route.fulfill({ json: BASE_GRAPH });
    if (url.includes('/artifact-versions/55/graph')) return route.fulfill({ json: TARGET_GRAPH });
    if (url.includes('/v1/artifacts/')) {
      return route.fulfill({
        json: {
          ...ARTIFACT,
          versions: [
            VERSION,
            { id: '54', versionNumber: '4', semanticVersion: '1.4.0', status: 'APPROVED' },
          ],
        },
      });
    }
    if (url.includes('/v1/environments')) {
      return route.fulfill({
        json: [{ code: 'PROD' }, { code: 'DEV' }, { code: 'TEST' }, { code: 'STAGING' }],
      });
    }
    return route.fulfill({ json: EMPTY_PAGE });
  });
}
