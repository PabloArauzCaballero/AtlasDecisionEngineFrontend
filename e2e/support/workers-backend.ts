import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';
import { WORKER_HISTORY, WORKER_METRICS } from './workers-history';
import { SEMANTIC_RESULT, STATEMENT_RESULT } from './workers-results';

/**
 * Motor simulado para las vistas de worker.
 *
 * El simulado normal devuelve páginas vacías, y con él las dos vistas nuevas
 * sólo pintan su cabecera y el formulario: no habría forma de medir el
 * seguimiento, el resultado ni el error, que es donde está casi todo el
 * comportamiento.
 *
 * Este sirve un ciclo de vida completo y **avanza con cada consulta**, igual
 * que lo haría el motor real: `QUEUED` → `RUNNING` → terminal. Devolver
 * directamente el estado final probaría una pantalla que en producción nunca se
 * ve así.
 */

/**
 * Catálogo: es lo que gobierna límites y disponibilidad en la vista.
 *
 * Array desnudo, NO `{ items }`. Es la convención del motor para colecciones no
 * paginadas (`ApiArrayResponse`), y el simulado la tenía mal: envolvía la
 * respuesta y por eso el E2E pasaba contra un contrato que el motor real no
 * sirve. Lo destapó el smoke por HTTP, no esta prueba.
 */
const CATALOG = [
  {
    code: 'semantic-analysis',
    name: 'Clasificación de gastos',
    description:
      'Clasifica la descripción de un movimiento contra el árbol de categorías de gasto e ingreso.',
    acceptedInputs: ['Texto libre', 'Escenario de prueba'],
    limits: { maxTextLength: 8000 },
    available: true,
    fixturesEnabled: true,
  },
  {
    code: 'bank-statement',
    name: 'Extractos bancarios',
    description: 'Convierte un extracto boliviano en PDF a movimientos normalizados.',
    acceptedInputs: ['Archivo PDF', 'Escenario de prueba'],
    limits: { maxUploadBytes: 10485760, maxFiles: 1, acceptedMimeTypes: 'application/pdf' },
    available: true,
    fixturesEnabled: true,
  },
];

/**
 * Escenarios, **uno por worker**.
 *
 * Los dos publican catálogos independientes y sus códigos no coinciden: el
 * clasificador sirve `gasto-claro` y el de extractos `valid-basic`. El simulado
 * los tenía fundidos en una sola lista, y funcionaba sólo porque entonces los
 * dos usaban el mismo código; en cuanto dejaron de coincidir, la vista de
 * extractos recibió el catálogo del clasificador y su selector se quedó sin la
 * opción que la prueba elige. Un simulado que reparte el mismo catálogo a todo
 * el mundo no prueba el catálogo, prueba la coincidencia.
 */
const FIXTURES = {
  'semantic-analysis': [
    {
      code: 'gasto-claro',
      name: 'Gasto de categoría clara',
      description: 'El camino feliz: debe terminar en éxito.',
      preview: 'COMPRA EN SUPERMERCADO HIPERMAXI SUCURSAL NORTE BS 487,90',
      expectsFailure: false,
    },
    {
      code: 'invalid-example',
      name: 'Entrada inválida',
      description: 'Debe rechazarse con un error controlado.',
      preview: '(texto vacío tras normalizar)',
      expectsFailure: true,
    },
  ],
  'bank-statement': [
    {
      code: 'valid-basic',
      name: 'Caso básico',
      description: 'El camino feliz: debe terminar en éxito.',
      preview: 'Extracto de una página con dos movimientos.',
      expectsFailure: false,
    },
    {
      code: 'invalid-example',
      name: 'Entrada inválida',
      description: 'Debe rechazarse con un error controlado.',
      preview: '(PDF ilegible)',
      expectsFailure: true,
    },
  ],
} as const;

function runEnvelope(worker: 'semantic-analysis' | 'bank-statement', poll: number) {
  const base = {
    requestId: `run-${worker}`,
    inputSource: 'FIXTURE',
    fixtureCode: worker === 'semantic-analysis' ? 'gasto-claro' : 'valid-basic',
    attemptCount: 1,
    queuedAt: '2026-08-04T10:00:00.000Z',
    requestedBy: 'pablo@atlas',
    correlationId: 'corr-e2e-0001',
    errorCode: null,
    errorMessage: null,
  };
  if (poll <= 1)
    return { ...base, status: 'QUEUED', progress: 0, startedAt: null, finishedAt: null };
  if (poll === 2) {
    return {
      ...base,
      status: 'RUNNING',
      progress: 45,
      startedAt: '2026-08-04T10:00:01.000Z',
      finishedAt: null,
    };
  }
  return {
    ...base,
    // Termina CON ADVERTENCIAS a propósito: es el estado que más fácil se
    // confunde con un éxito limpio, y el que la vista tiene que distinguir.
    status: 'SUCCEEDED_WITH_WARNINGS',
    progress: 100,
    startedAt: '2026-08-04T10:00:01.000Z',
    finishedAt: '2026-08-04T10:00:04.000Z',
    result: worker === 'semantic-analysis' ? SEMANTIC_RESULT : STATEMENT_RESULT,
    warnings:
      worker === 'semantic-analysis'
        ? ['presupuesto del tenant al 90%']
        : STATEMENT_RESULT.quality.warnings,
  };
}

/**
 * A qué worker se dirige la petición.
 *
 * Se deriva de la URL y no de un parámetro porque el simulado intercepta todas
 * las rutas a la vez: las dos consolas conviven montadas en la misma pestaña.
 */
function workerOf(url: string): keyof typeof FIXTURES {
  return url.includes('bank-statement') ? 'bank-statement' : 'semantic-analysis';
}

/** Instala el motor simulado de workers con un ciclo de vida que progresa. */
export async function mockWorkersBackend(page: Page): Promise<void> {
  let polls = 0;

  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/workers/') && url.includes('/fixtures')) {
      return route.fulfill({ json: FIXTURES[workerOf(url)] });
    }
    // Salud del worker: la calcula el motor, la vista sólo la pinta.
    if (url.includes('/v1/workers/') && url.includes('/metrics')) {
      return route.fulfill({ json: { ...WORKER_METRICS, worker: workerOf(url) } });
    }
    if (/\/v1\/workers\/?(\?|$)/.test(url)) return route.fulfill({ json: CATALOG });

    const worker = workerOf(url);

    if (url.includes('/runs/') && route.request().method() === 'GET') {
      polls += 1;
      return route.fulfill({ json: runEnvelope(worker, polls) });
    }
    // El historial del panel de control. Va ANTES del alta porque `/runs` sin
    // identificador casa con las dos, y sólo el método las distingue.
    if (url.includes('/runs') && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          items: WORKER_HISTORY,
          page: 1,
          pageSize: 50,
          total: WORKER_HISTORY.length,
          totalPages: 1,
        },
      });
    }
    if (url.includes('/runs') && route.request().method() === 'POST') {
      polls = 0;
      return route.fulfill({ status: 202, json: runEnvelope(worker, 0) });
    }
    return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0 } });
  });
}
