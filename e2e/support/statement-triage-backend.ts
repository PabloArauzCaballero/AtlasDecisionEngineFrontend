import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';
import { CATALOG, FIXTURES } from './workers-catalog';
import { WORKER_METRICS } from './workers-history';
import { STATEMENT_RESULT } from './workers-results';

/**
 * Motor simulado del TRIAGE de extractos.
 *
 * Aparte de `workers-backend.ts` porque afirma otra cosa: aquél sirve un ciclo
 * de vida que siempre acaba bien, y aquí lo que hay que poder recorrer son los
 * cuatro desenlaces —procesado, rechazado, dudoso y vencido por reloj— y la cola
 * que sale de dos de ellos. Meterlos en el mismo simulado obligaría a que cada
 * prueba de la consola supiera qué escenario está activo.
 *
 * El ciclo de vida AVANZA con cada consulta, igual que el motor real: `QUEUED` →
 * `RUNNING` → terminal. Servir el estado final desde el principio probaría una
 * pantalla que en producción nunca se ve así, y en particular NO probaría que el
 * aviso salta al llegar el desenlace —que es justo lo que estas pruebas existen
 * para comprobar—.
 */

export type EscenarioTriage = 'procesado' | 'invalido' | 'dudoso' | 'timeout';

const BASE = {
  requestId: 'run-extracto',
  inputSource: 'UPLOAD',
  fixtureCode: null,
  attemptCount: 1,
  queuedAt: '2026-08-16T10:00:00.000Z',
  startedAt: '2026-08-16T10:00:01.000Z',
  requestedBy: 'analista@atlas',
  correlationId: 'corr-triage-0001',
};

/** El desenlace de cada escenario, con el motivo que lo explica. */
const DESENLACE: Record<EscenarioTriage, Record<string, unknown>> = {
  procesado: {
    status: 'SUCCEEDED',
    result: STATEMENT_RESULT,
    errorCode: null,
    errorMessage: null,
    reviewReason: null,
    rejectionReason: null,
  },
  invalido: {
    status: 'PDF_INVALID',
    rejectionReason: 'NOT_BANK_STATEMENT',
    reviewReason: null,
    errorCode: 'NOT_A_FINANCIAL_STATEMENT',
    errorMessage: 'El documento no reúne señales suficientes de ser un estado de cuenta.',
  },
  dudoso: {
    status: 'PENDING_REVIEW',
    reviewReason: 'DOUBTFUL_DOCUMENT',
    reviewPriority: 3,
    rejectionReason: null,
    errorCode: 'DOUBTFUL_DOCUMENT',
    errorMessage: 'El documento se parece a un estado de cuenta, pero no se pudo confirmar.',
  },
  timeout: {
    status: 'PENDING_REVIEW',
    reviewReason: 'TIMEOUT',
    reviewPriority: 1,
    rejectionReason: null,
    errorCode: 'PDF_PROCESSING_TIMEOUT',
    errorMessage: 'El PDF tardó demasiado en procesarse.',
  },
};

/** Los contadores que el motor calcula sobre la cola COMPLETA, no sobre la página. */
export const CATEGORIAS_COLA = [
  { category: null, total: 3, claimed: 0, oldestPendingMs: 5_400_000 },
  { category: 'TIMEOUT', total: 2, claimed: 0, oldestPendingMs: 5_400_000 },
  { category: 'DOUBTFUL_DOCUMENT', total: 1, claimed: 0, oldestPendingMs: 900_000 },
];

const CASO_TIMEOUT = {
  requestId: 'rev-timeout-1',
  fileName: 'extracto-marzo.pdf',
  requestedBy: 'analista@atlas',
  status: 'PENDING_REVIEW',
  reviewReason: 'TIMEOUT',
  reviewPriority: 1,
  errorCode: 'PDF_PROCESSING_TIMEOUT',
  errorMessage: 'El PDF tardó demasiado en procesarse.',
  institutionId: 'BNB',
  documentTypeConfidence: 0.86,
  extractionConfidence: null,
  transactionCount: null,
  reviewOpenedAt: '2026-08-16T08:30:00.000Z',
  pendingMs: 5_400_000,
  reviewClaimedBy: null,
  reviewClaimedAt: null,
  queuedAt: '2026-08-16T08:25:00.000Z',
};

const CASO_DUDOSO = {
  ...CASO_TIMEOUT,
  requestId: 'rev-dudoso-1',
  fileName: 'documento-escaneado.pdf',
  reviewReason: 'DOUBTFUL_DOCUMENT',
  reviewPriority: 3,
  errorCode: 'DOUBTFUL_DOCUMENT',
  errorMessage: 'El documento se parece a un estado de cuenta, pero no se pudo confirmar.',
  institutionId: null,
  documentTypeConfidence: 0.38,
  pendingMs: 900_000,
};

const CASOS = [CASO_TIMEOUT, CASO_DUDOSO];

function pagina(categoria: string | null) {
  const items = categoria ? CASOS.filter((caso) => caso.reviewReason === categoria) : CASOS;
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1, hasNextPage: false };
}

export async function mockStatementTriage(page: Page, escenario: EscenarioTriage): Promise<void> {
  let polls = 0;

  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    const metodo = route.request().method();

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/fixtures')) return route.fulfill({ json: FIXTURES['bank-statement'] });
    if (url.includes('/metrics')) {
      return route.fulfill({ json: { ...WORKER_METRICS, worker: 'bank-statement' } });
    }
    if (/\/v1\/workers\/?(\?|$)/.test(url)) return route.fulfill({ json: CATALOG });

    // --- La cola de revisión -------------------------------------------------
    if (url.includes('/reviews/categories')) return route.fulfill({ json: CATEGORIAS_COLA });
    if (url.includes('/reviews') && metodo === 'POST') {
      return route.fulfill({ json: { ...CASO_TIMEOUT, status: 'IN_REVIEW' } });
    }
    if (url.includes('/reviews/')) {
      const caso = url.includes('rev-dudoso-1') ? CASO_DUDOSO : CASO_TIMEOUT;
      return route.fulfill({
        json: {
          ...caso,
          result: null,
          fileHash: 'a'.repeat(64),
          fileSizeBytes: 240_000,
          correlationId: 'corr-triage-0001',
          attemptCount: 1,
          reviewNotes: null,
          documentAvailable: true,
        },
      });
    }
    if (url.includes('/reviews')) {
      const categoria = new URL(url).searchParams.get('category');
      return route.fulfill({ json: pagina(categoria) });
    }

    // --- La conversión -------------------------------------------------------
    if (url.includes('/runs/') && metodo === 'GET') {
      polls += 1;
      if (polls <= 1) {
        return route.fulfill({
          json: { ...BASE, status: 'QUEUED', progress: 0, startedAt: null, finishedAt: null },
        });
      }
      return route.fulfill({
        json: {
          ...BASE,
          progress: 100,
          finishedAt: '2026-08-16T10:00:09.000Z',
          ...DESENLACE[escenario],
        },
      });
    }
    if (url.includes('/runs') && metodo === 'POST') {
      polls = 0;
      return route.fulfill({
        status: 202,
        json: { ...BASE, status: 'QUEUED', progress: 0, startedAt: null, finishedAt: null },
      });
    }
    if (url.includes('/runs') && metodo === 'GET') {
      return route.fulfill({ json: { items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 } });
    }
    return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0 } });
  });
}
