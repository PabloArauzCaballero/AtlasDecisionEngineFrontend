import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Datos del panel de inicio.
 *
 * Todo sale de endpoints reales; no hay ni un número inventado. Cada bloque se
 * pide por separado y se resuelve con `allSettled`: si el backend todavía no
 * expone un recurso —o el usuario no tiene permiso sobre él— esa tarjeta se
 * marca como no disponible y el resto del panel sigue mostrando información
 * verdadera, en lugar de caerse entero o rellenar con ceros falsos.
 */

export interface CountedResource {
  /** Total declarado por el backend. `null` cuando el recurso no está disponible. */
  total: number | null;
  items: UnknownRecord[];
}

export interface DashboardSnapshot {
  artifacts: CountedResource;
  executions: CountedResource;
  deployments: CountedResource;
  environments: CountedResource;
  manualReviews: CountedResource;
  approvals: CountedResource;
  testQuality: QualitySignal;
  /** Ejecuciones recientes cuyo estado indica fallo. */
  failedExecutions: UnknownRecord[];
}

export interface QualitySignal {
  /** Ejecuciones de suites que ya terminaron (aprobadas + fallidas). */
  concluded: number | null;
  /**
   * Porcentaje aprobado sobre esas ejecuciones concluidas. `null` mientras no
   * haya ninguna: un 0 % ahí sería una mentira alarmante.
   */
  passRate: number | null;
}

const UNAVAILABLE: CountedResource = { total: null, items: [] };

/**
 * Lee un recurso paginado. Acepta las dos formas que devuelve el backend —
 * página (`{items,total}`) o lista suelta— porque `/v1/environments` responde
 * como array y el resto como página.
 */
async function readResource(endpoint: string, signal?: AbortSignal): Promise<CountedResource> {
  const response = await apiRequest<unknown>(endpoint, { signal });
  if (Array.isArray(response)) {
    const items = asRows(response);
    return { total: items.length, items };
  }
  const page = asRecord(response);
  const items = asRows(page.items ?? page.content ?? page.data);
  const total = typeof page.total === 'number' ? page.total : items.length;
  return { total, items };
}

async function safeResource(endpoint: string, signal?: AbortSignal): Promise<CountedResource> {
  try {
    return await readResource(endpoint, signal);
  } catch {
    return UNAVAILABLE;
  }
}

const FAILURE_STATES = new Set(['FAILED', 'ERROR', 'REJECTED', 'TIMEOUT', 'CANCELLED']);

/** Una ejecución cuenta como fallida si su estado o su desenlace lo dicen. */
export function isFailedExecution(row: UnknownRecord): boolean {
  const status = display(row, 'status', 'outcome', 'result').toUpperCase();
  return FAILURE_STATES.has(status);
}

const PENDING_STATES = new Set(['PENDING', 'OPEN', 'IN_REVIEW', 'ASSIGNED', 'QUEUED', 'WAITING']);

/** Un caso o una aprobación siguen requiriendo intervención humana. */
export function isPending(row: UnknownRecord): boolean {
  const status = display(row, 'status', 'state').toUpperCase();
  return PENDING_STATES.has(status);
}

/**
 * Calidad de las pruebas, leída de la bitácora de auditoría.
 *
 * El motor no expone un listado global de ejecuciones de prueba (`/v1/test-runs`
 * sólo responde por identificador), pero sí registra en la bitácora un evento
 * por cada ejecución que termina. Contando esos eventos se obtiene el dato real
 * con dos peticiones de una fila cada una: sólo interesa el total, no las filas.
 *
 * Las ejecuciones encoladas o en curso no entran en el denominador: contarlas
 * como fallidas haría caer el indicador sólo por tener el worker ocupado.
 */
export function qualityFrom(passed: number | null, failed: number | null): QualitySignal {
  if (passed === null || failed === null) return { concluded: null, passRate: null };
  const concluded = passed + failed;
  if (concluded === 0) return { concluded: 0, passRate: null };
  return { concluded, passRate: Math.round((passed / concluded) * 1000) / 10 };
}

/** Total declarado por un listado paginado, o `null` si no está disponible. */
async function safeTotal(endpoint: string, signal?: AbortSignal): Promise<number | null> {
  return (await safeResource(endpoint, signal)).total;
}

const AUDIT_EVENTS = '/v1/audit/events?page=1&pageSize=1&aggregateType=TestRun&eventType=';

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardSnapshot> {
  const [
    artifacts,
    executions,
    deployments,
    environments,
    manualReviews,
    approvals,
    passed,
    failed,
  ] = await Promise.all([
    safeResource('/v1/artifacts?page=1&pageSize=1', signal),
    safeResource('/v1/audit/executions?page=1&pageSize=6', signal),
    safeResource('/v1/deployments?page=1&pageSize=6', signal),
    safeResource('/v1/environments', signal),
    safeResource('/v1/manual-reviews?page=1&pageSize=6', signal),
    safeResource('/v1/approval-requests?page=1&pageSize=6', signal),
    safeTotal(`${AUDIT_EVENTS}TEST_RUN_PASSED`, signal),
    safeTotal(`${AUDIT_EVENTS}TEST_RUN_FAILED`, signal),
  ]);

  return {
    artifacts,
    executions,
    deployments,
    environments,
    manualReviews,
    approvals,
    testQuality: qualityFrom(passed, failed),
    failedExecutions: executions.items.filter(isFailedExecution),
  };
}

/** Texto de una métrica: el total real, o un guion si el recurso no respondió. */
export function metricText(resource: CountedResource): string {
  return resource.total === null ? '—' : String(resource.total);
}
