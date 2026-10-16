import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { MOCK_SESSION } from './support/backend-mock';
import { CATALOG } from './support/workers-catalog';
import { WORKER_METRICS } from './support/workers-history';
import { STATEMENT_RESULT } from './support/workers-results';

/**
 * Un extracto de banco no reconocido, revisado con todo a la vista (2026-10-15).
 *
 * Pablo: «no me deja ver el PDF subido, para poder manualmente ponerle la entidad» y «que haga el
 * ejercicio que ya sabe hacer: ingresos, gastos y categorías». Se comprueba que el caso enseña el
 * PDF, el análisis provisional y el selector de entidad, y que reprocesar manda la entidad elegida.
 * Con `REVISION_SHOTS=<carpeta>` deja capturas en claro y oscuro.
 */

const PDF_MINIMO =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';

const CASO = {
  requestId: 'rev-banco-1',
  fileName: 'extracto-julio-septiembre.pdf',
  requestedBy: 'cliente-53',
  status: 'IN_REVIEW',
  reviewReason: 'UNKNOWN_BANK',
  reviewPriority: 2,
  errorCode: 'UNSUPPORTED_INSTITUTION',
  errorMessage: 'No se pudo reconocer una entidad financiera boliviana compatible.',
  institutionId: null,
  documentTypeConfidence: 0.91,
  extractionConfidence: 0.84,
  transactionCount: 24,
  reviewOpenedAt: '2026-10-07T22:26:15.000Z',
  pendingMs: 8 * 24 * 3_600_000,
  reviewClaimedBy: MOCK_SESSION.user.id,
  reviewClaimedAt: '2026-10-15T20:00:00.000Z',
  queuedAt: '2026-10-07T22:26:00.000Z',
};

async function simular(page: Page, reprocesos: unknown[]) {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', async (route) => {
    const url = route.request().url();
    const metodo = route.request().method();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/metrics'))
      return route.fulfill({ json: { ...WORKER_METRICS, worker: 'bank-statement' } });
    if (/\/v1\/workers\/?(\?|$)/.test(url)) return route.fulfill({ json: CATALOG });
    if (url.includes('/institutions/summary')) {
      return route.fulfill({
        json: { active: 2, byKind: {}, withoutLicense: 0, missingFromSeed: ['BGA'] },
      });
    }
    if (url.includes('/institutions')) {
      return route.fulfill({
        json: [
          {
            code: 'BNB',
            name: 'Banco Nacional de Bolivia S.A.',
            kind: 'MULTIPLE_BANK',
            licenseStatus: 'LICENSED',
          },
          {
            code: 'BUN',
            name: 'Banco Unión S.A.',
            kind: 'MULTIPLE_BANK',
            licenseStatus: 'LICENSED',
          },
        ],
      });
    }
    if (url.includes('/reviews/categories')) {
      return route.fulfill({
        json: [{ category: null, total: 1, claimed: 1, oldestPendingMs: CASO.pendingMs }],
      });
    }
    if (url.endsWith('/document')) {
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF_MINIMO });
    }
    if (url.includes('/reprocess') && metodo === 'POST') {
      reprocesos.push(route.request().postDataJSON());
      return route.fulfill({ json: { requestId: CASO.requestId, status: 'QUEUED' } });
    }
    if (url.includes('/reviews/')) {
      return route.fulfill({
        json: {
          ...CASO,
          result: null,
          provisional: STATEMENT_RESULT,
          assignedInstitution: null,
          // 2026-10-16: el titular exigido frente al leído.
          holder: {
            expected: 'Juan Carlos Pérez Gómez',
            read: 'PEREZ GOMEZ JUAN CARLOS',
            verdict: 'MATCH',
          },
          warnings: [],
          fileHash: 'a'.repeat(64),
          fileSizeBytes: 240_000,
          correlationId: 'corr-revision-0001',
          attemptCount: 1,
          reviewNotes: null,
          documentAvailable: true,
        },
      });
    }
    if (url.includes('/reviews')) {
      return route.fulfill({
        json: { items: [CASO], page: 1, pageSize: 20, total: 1, totalPages: 1, hasNextPage: false },
      });
    }
    return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0 } });
  });
}

for (const tema of ['light', 'dark'] as const) {
  test(`el caso enseña el PDF, el análisis provisional y reprocesa con la entidad (${tema})`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const reprocesos: unknown[] = [];
    await page.addInitScript((valor) => window.localStorage.setItem('atlas.theme', valor), tema);
    await simular(page, reprocesos);
    await page.goto('/workers/bank-statement?vista=revision', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });

    const caso = page.locator('.revision-caso').first();
    await caso.locator('summary').click();
    await expect(caso.getByTestId('statement-provisional')).toBeVisible({ timeout: 60_000 });
    await expect(caso.getByText('Análisis provisional')).toBeVisible();
    // De quién es la cuenta: el cliente frente a lo que dice la carátula (2026-10-16).
    const titular = caso.getByTestId('statement-holder');
    await expect(titular).toContainText('Juan Carlos Pérez Gómez');
    await expect(titular).toContainText('PEREZ GOMEZ JUAN CARLOS');
    await expect(titular).toContainText('Coincide con el cliente');

    await caso.getByRole('button', { name: 'Ver el PDF subido' }).click();
    await expect(caso.locator('iframe.case-files__viewer')).toHaveAttribute('src', /^blob:/);

    const selector = caso.getByRole('combobox', { name: /Entidad que emitió el extracto/ });
    await selector.click();
    await page.getByRole('option', { name: /BGA/ }).click();

    const carpeta = process.env.REVISION_SHOTS;
    if (carpeta) {
      await mkdir(carpeta, { recursive: true });
      await caso.screenshot({
        path: `${carpeta}/${tema === 'light' ? 'claro' : 'oscuro'}-caso-extracto.png`,
      });
    }

    await caso.getByRole('button', { name: 'Reprocesar con esta entidad' }).click();
    await expect.poll(() => reprocesos).toEqual([{ institutionCode: 'BGA' }]);
  });
}
