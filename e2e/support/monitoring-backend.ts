import type { Page } from '@playwright/test';
import { EMPTY_PAGE, MOCK_SESSION } from './backend-mock';

/**
 * Motor simulado CON DATOS para el monitoreo del modelo y los derechos del titular.
 *
 * El simulado genérico devuelve listados vacíos, así que una prueba escrita contra él mediría
 * cabeceras y estados vacíos creyendo que mide la vista. Aquí las cifras están elegidas para que
 * cada una diga algo comprobable:
 *
 * - `badRate` alto y `falseDeclineRate` alto: las dos caras del error, y la segunda es la que casi
 *   nadie mira porque sus malos nunca entraron.
 * - `psi` por encima de 0,25: población distinta, no desplazada.
 * - un grupo por debajo de 0,8 en impacto adverso, y otro excluido por muestra pequeña.
 */
export const PERFORMANCE = {
  artifactVersionId: '4001',
  observed: 1200,
  conclusive: 940,
  approved: 700,
  declined: 240,
  badRate: 0.124,
  goodRate: 0.876,
  falseDeclineRate: 0.183,
  discrimination: 0.62,
};

export const STABILITY = {
  artifactVersionId: '4001',
  variableCode: 'ingresos_mensuales',
  psi: 0.312,
  verdict: 'UNSTABLE',
  referenceCount: 5000,
  currentCount: 4800,
  buckets: [
    { bucket: 'n:9', referenceShare: 0.32, currentShare: 0.11, contribution: 0.23 },
    { bucket: 'n:4', referenceShare: 0.18, currentShare: 0.29, contribution: 0.05 },
  ],
};

export const ADVERSE_IMPACT = {
  artifactVersionId: '4001',
  attribute: 'AGE_BAND',
  analyzed: 1500,
  referenceGroup: '26-40',
  ignoredForSmallSample: ['18-25'],
  groups: [
    {
      group: '26-40',
      total: 800,
      approved: 640,
      approvalRate: 0.8,
      impactRatio: 1,
      belowThreshold: false,
    },
    {
      group: '60+',
      total: 420,
      approved: 210,
      approvalRate: 0.5,
      impactRatio: 0.625,
      belowThreshold: true,
    },
  ],
  flagged: true,
};

export const DSR_RESULT = {
  id: '77',
  requestType: 'ACCESS',
  status: 'FULFILLED',
  createdAt: '2026-08-08T10:00:00.000Z',
  matchedDecisions: 2,
  resolution: { matchedDecisions: 2, truncated: true, scope: 'Decisiones y motivos públicos' },
  decisions: [
    {
      executionId: '88001',
      requestId: 'req-8f2a',
      status: 'SUCCEEDED',
      outcome: 'DECLINED',
      executedAt: '2026-03-01T00:00:00.000Z',
      artifactCode: 'CREDIT_ORIGINATION',
      artifactName: 'Originación de crédito al consumo',
      versionNumber: 3,
      reasons: [
        {
          code: 'INSUFFICIENT_INCOME',
          message: 'Ingresos insuficientes para el importe solicitado',
          adverseAction: true,
        },
      ],
    },
  ],
};

export const DSR_HISTORY = {
  total: 1,
  items: [
    {
      id: '70',
      requestType: 'ERASURE',
      status: 'REJECTED',
      receivedBy: 'compliance@atlas.local',
      reference: 'TICKET-9912',
      createdAt: '2026-07-01T09:00:00.000Z',
      resolvedAt: '2026-07-01T09:05:00.000Z',
    },
  ],
};

export async function monitoringBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/model-monitoring/performance'))
      return route.fulfill({ json: PERFORMANCE });
    if (url.includes('/v1/model-monitoring/stability')) return route.fulfill({ json: STABILITY });
    if (url.includes('/v1/model-monitoring/adverse-impact'))
      return route.fulfill({ json: ADVERSE_IMPACT });
    if (url.includes('/v1/data-subject-requests/history'))
      return route.fulfill({ json: DSR_HISTORY });
    if (url.includes('/v1/data-subject-requests')) return route.fulfill({ json: DSR_RESULT });
    /*
     * El selector de versión es de DOS pasos: primero el artefacto, luego sus versiones. Sin
     * ambas listas el botón «Medir» nace inhabilitado y la prueba mediría un formulario apagado
     * creyendo que mide la vista — que es exactamente lo que el simulado genérico provoca.
     */
    if (url.includes('/v1/views/pickers/artifacts')) {
      return route.fulfill({
        json: { items: [{ artifactCode: 'CREDIT_ORIGINATION', name: 'Originación de crédito' }] },
      });
    }
    if (url.includes('/v1/views/pickers/artifact-versions') || url.includes('artifactCode=')) {
      return route.fulfill({
        json: { items: [{ id: '4001', semanticVersion: '3.0.0', status: 'DEPLOYED' }] },
      });
    }
    return route.fulfill({ json: EMPTY_PAGE });
  });
}
