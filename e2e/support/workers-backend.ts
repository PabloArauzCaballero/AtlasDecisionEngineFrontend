import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';

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
    name: 'Análisis semántico',
    description: 'Clasifica un texto libre contra el catálogo de categorías.',
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

const FIXTURES = [
  {
    code: 'valid-basic',
    name: 'Caso básico',
    description: 'El camino feliz: debe terminar en éxito.',
    preview: 'Hay un cargo en mi tarjeta que yo no hice.',
    expectsFailure: false,
  },
  {
    code: 'invalid-example',
    name: 'Entrada inválida',
    description: 'Debe rechazarse con un error controlado.',
    preview: '(texto vacío tras normalizar)',
    expectsFailure: true,
  },
];

const SEMANTIC_RESULT = {
  requestId: 'run-semantico',
  status: 'MATCH',
  normalizedText: 'hay un cargo en mi tarjeta que yo no hice',
  entities: [
    {
      type: 'INSTITUCION',
      canonicalName: 'Banco Ganadero',
      sourceText: 'Ganadero',
      confidence: 0.9,
    },
  ],
  matches: [
    {
      categoryCode: 'COBRO_NO_RECONOCIDO',
      confidence: 0.91,
      supported: true,
      contradicted: false,
      evidence: ['«un cargo que yo no hice» afirma desconocimiento del cargo'],
      rationale: 'El texto desconoce un cargo ya aplicado.',
    },
  ],
  evaluatedCategoryCodes: ['COBRO_NO_RECONOCIDO', 'FRAUDE_SOSPECHADO'],
  tierUsed: 'FAST',
  model: 'gpt-4o-mini',
  modelVersion: '2026-05',
  processingTimeMs: 812,
};

const STATEMENT_RESULT = {
  source: { fileName: 'extracto.pdf', fileHash: 'abc123', pageCount: 1, extractionMethod: 'TEXT' },
  institution: {
    id: 'BGA',
    name: 'Banco Ganadero S.A.',
    normalizedName: 'banco ganadero',
    country: 'BO',
    detected: true,
    confidence: 0.98,
  },
  // Enmascarada SIEMPRE: la vista no debe poder enseñar un número completo ni
  // aunque el motor se equivocara, y esto lo deja comprobable desde la prueba.
  account: {
    holderName: 'CLIENTE DE PRUEBA',
    accountNumberMasked: '******7890',
    accountType: 'CORRIENTE',
    currency: 'BOB',
    allAccountsMasked: ['******7890'],
  },
  period: { from: '2026-03-01', to: '2026-03-31' },
  balances: { opening: 10000, closing: 11250 },
  totals: { debit: 250, credit: 1500 },
  processing: {
    documentType: 'BANK_STATEMENT',
    strategyId: 'generic:table-inference-v1',
    strategyKind: 'GENERIC',
    strategyVersion: '1',
    detectionReasons: [],
    durationMs: 2868,
  },
  transactions: [
    {
      id: 't1',
      index: 0,
      transactionDate: '2026-03-02',
      valueDate: null,
      description: 'PAGO SERVICIOS (CUOTA 3)',
      reference: null,
      documentNumber: null,
      debit: 250,
      credit: null,
      amount: -250,
      balance: 9750,
      currency: 'BOB',
      movementType: 'DEBIT',
      channel: null,
      branch: null,
      rawText: null,
      accountMasked: '******7890',
    },
    {
      id: 't2',
      index: 1,
      transactionDate: '2026-03-05',
      valueDate: null,
      description: 'DEPOSITO EN EFECTIVO',
      reference: null,
      documentNumber: null,
      debit: null,
      credit: 1500,
      amount: 1500,
      balance: 11250,
      currency: 'BOB',
      movementType: 'CREDIT',
      channel: null,
      branch: null,
      rawText: null,
      accountMasked: '******7890',
    },
  ],
  quality: {
    documentConfidence: 0.95,
    institutionConfidence: 0.98,
    structureConfidence: 0.9,
    reconciliationConfidence: 1,
    overallConfidence: 0.92,
    band: 'ALTA',
    checksRun: 6,
    checksPassed: 6,
    warnings: ['renglones-no-atribuidos:1'],
    errors: [],
  },
};

function runEnvelope(worker: 'semantic-analysis' | 'bank-statement', poll: number) {
  const base = {
    requestId: `run-${worker}`,
    inputSource: 'FIXTURE',
    fixtureCode: 'valid-basic',
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

/** Instala el motor simulado de workers con un ciclo de vida que progresa. */
export async function mockWorkersBackend(page: Page): Promise<void> {
  let polls = 0;

  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/workers/') && url.includes('/fixtures')) {
      return route.fulfill({ json: FIXTURES });
    }
    if (/\/v1\/workers\/?(\?|$)/.test(url)) return route.fulfill({ json: CATALOG });

    const worker = url.includes('bank-statement') ? 'bank-statement' : 'semantic-analysis';

    if (url.includes('/runs/') && route.request().method() === 'GET') {
      polls += 1;
      return route.fulfill({ json: runEnvelope(worker, polls) });
    }
    if (url.includes('/runs') && route.request().method() === 'POST') {
      polls = 0;
      return route.fulfill({ status: 202, json: runEnvelope(worker, 0) });
    }
    return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0 } });
  });
}
