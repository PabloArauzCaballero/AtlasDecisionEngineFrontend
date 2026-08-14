import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';
import { GRAPH } from './graph-fixtures';

/**
 * Motor simulado para medir cómo se AVISA, no qué se pinta.
 *
 * Las otras suites quieren un backend que conteste bien; ésta necesita uno que
 * falle a voluntad y que sepa transmitir una ejecución por SSE, porque el motor
 * de avisos sólo se puede juzgar cuando algo sale mal o algo tarda.
 */

const VACIO = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, hasNextPage: false };

const ARTEFACTOS = [{ artifactCode: 'BNPL_CREDIT_DECISION', name: 'Decisión BNPL' }];

const VERSIONES = [
  {
    id: 'ver-demo',
    artifactCode: 'BNPL_CREDIT_DECISION',
    semanticVersion: '1.0.0',
    status: 'DRAFT',
  },
];

/** Forma completa de `environmentSchema`: sin `environmentType` se descarta. */
const AMBIENTES = [
  {
    id: '1',
    code: 'DEV',
    name: 'Development',
    environmentType: 'DEV',
    status: 'ACTIVE',
    isProduction: false,
  },
];

/** Una ejecución completa, en el formato de marcos que lee `apiEventStream`. */
function eventStream(frames: { type: string; data: unknown }[]): string {
  return frames.map((f) => `event: ${f.type}\ndata: ${JSON.stringify(f.data)}\n\n`).join('');
}

const EJECUCION = eventStream([
  { type: 'node_step', data: { nodeKey: 'inicio', status: 'COMPLETED', durationMs: 4 } },
  { type: 'node_step', data: { nodeKey: 'score', status: 'COMPLETED', durationMs: 9 } },
  { type: 'execution_completed', data: { decision: 'APPROVE', nestedExecutions: [] } },
]);

interface Opciones {
  /** Estado con el que responder al guardado de notas. `200` para que funcione. */
  notesStatus?: number;
}

export async function notificationsBackend(page: Page, options: Opciones = {}): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();

    if (url.includes('/v1/live-executions/stream')) {
      return route.fulfill({ contentType: 'text/event-stream', body: EJECUCION });
    }
    /*
     * El guardado de notas es el disparador de fallos repetidos: se pulsa varias
     * veces y el motor contesta siempre lo mismo, que es justo el caso que antes
     * apilaba una tarjeta idéntica por intento.
     */
    if (url.includes('/notes')) {
      const status = options.notesStatus ?? 500;
      if (status >= 400) {
        return route.fulfill({
          status,
          json: { code: 'ENGINE_UNAVAILABLE', message: 'El motor no está disponible.' },
        });
      }
      return route.fulfill({ json: { ok: true } });
    }

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('unread-count')) return route.fulfill({ json: { unread: 0 } });
    if (url.includes('/v1/environments')) return route.fulfill({ json: AMBIENTES });
    if (url.includes('/pickers/artifacts')) return route.fulfill({ json: ARTEFACTOS });
    if (url.includes('/pickers/artifact-versions')) return route.fulfill({ json: VERSIONES });
    if (/\/v1\/artifact-versions\/[^/]+\/graph/.test(url)) return route.fulfill({ json: GRAPH });
    if (/\/v1\/artifact-versions\/[^/]+$/.test(url)) {
      return route.fulfill({ json: { id: 'ver-demo', lockVersion: 1, status: 'DRAFT' } });
    }
    return route.fulfill({ json: VACIO });
  });
}
