import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';
import { IDENTITY_RESULT } from './identity-result';
import { AUDIO_BYTES, AUDIO_TEMPLATES, CATALOG, FIXTURES } from './workers-catalog';
import { WORKER_HISTORY, WORKER_METRICS } from './workers-history';
import { AUDIO_RESULT, SEMANTIC_RESULT, STATEMENT_RESULT } from './workers-results';

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

function runEnvelope(worker: keyof typeof FIXTURES, poll: number) {
  const base = {
    requestId: `run-${worker}`,
    inputSource: 'FIXTURE',
    fixtureCode: FIXTURES[worker][0].code,
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
    result: RESULT_OF[worker],
    warnings: WARNINGS_OF[worker],
  };
}

const RESULT_OF: Record<keyof typeof FIXTURES, unknown> = {
  'semantic-analysis': SEMANTIC_RESULT,
  'bank-statement': STATEMENT_RESULT,
  'identity-verification': IDENTITY_RESULT,
  'audio-tts': AUDIO_RESULT,
};

const WARNINGS_OF: Record<keyof typeof FIXTURES, string[]> = {
  'semantic-analysis': ['presupuesto del tenant al 90%'],
  'bank-statement': STATEMENT_RESULT.quality.warnings,
  // Lo que el motor guarda en `warnings_json`: los motivos de la decisión más
  // las marcas de riesgo, deduplicados.
  'identity-verification': [...IDENTITY_RESULT.reasonCodes, ...IDENTITY_RESULT.riskFlags],
  'audio-tts': ['Se sirvió el audio de respaldo, no el que se pidió.'],
};

/**
 * A qué worker se dirige la petición.
 *
 * Se deriva de la URL y no de un parámetro porque el simulado intercepta todas
 * las rutas a la vez: las dos consolas conviven montadas en la misma pestaña.
 */
function workerOf(url: string): keyof typeof FIXTURES {
  if (url.includes('identity-verification')) return 'identity-verification';
  if (url.includes('audio-tts')) return 'audio-tts';
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
    if (url.includes('/v1/workers/audio-tts/templates')) {
      return route.fulfill({ json: AUDIO_TEMPLATES });
    }
    // El audio va por la puerta autenticada, no por un `src` directo: la
    // consola lo pide con la credencial puesta y lo reproduce como blob.
    if (url.includes('/v1/workers/audio-tts/runs/') && url.endsWith('/audio')) {
      return route.fulfill({ contentType: 'audio/mpeg', body: AUDIO_BYTES });
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
