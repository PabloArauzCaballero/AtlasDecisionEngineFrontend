import type { Page } from '@playwright/test';
import { mockBackend } from './backend-mock';

/**
 * AtlasBackend simulado para el cuaderno de datos.
 *
 * El simulado general cubre `/v1/**` —el motor— y el cuaderno no lee de ahí: lee de
 * `/atlas-backend/**`, el proxy hacia AtlasBackend. Sin este añadido la pantalla se quedaría en
 * «Cargando el catálogo de datos…» y la prueba mediría un estado de carga creyendo que mide la
 * vista.
 *
 * Sirve DOS páginas de verdad y no una: la paginación del servidor sólo se comprueba si la
 * segunda página trae filas distintas de la primera. Con un simulado que devuelve siempre lo
 * mismo, un botón «Siguiente» desconectado pasa la prueba.
 */

const CATALOGO = {
  datasets: [
    {
      code: 'customer-overview',
      view: 'v_customer_overview_v1',
      label: 'Panorama de clientes',
      description: 'Una fila por cliente con su estado, consentimientos y casos abiertos.',
    },
    {
      code: 'audit-event-feed',
      view: 'v_audit_event_feed_v1',
      label: 'Bitácora de auditoría',
      description: 'Eventos de auditoría en orden cronológico inverso.',
    },
  ],
  limits: {
    maxPageSize: 500,
    defaultPageSize: 100,
    maxDatasetRows: 20_000,
    countCeiling: 200_000,
    ratePerMinute: 60,
    maxResponseBytes: 8 * 1024 * 1024,
  },
  reveal: false,
};

/** Incluye una columna enmascarada y una redactada: son las dos que la pantalla debe rotular. */
const COLUMNAS = [
  { name: 'customer_id', dataType: 'uuid', piiType: null, policy: 'PLAIN', reason: null },
  { name: 'status', dataType: 'text', piiType: null, policy: 'PLAIN', reason: null },
  {
    name: 'contact_email',
    dataType: 'text',
    piiType: 'EMAIL',
    policy: 'MASKED',
    reason: 'Dato personal (EMAIL) enmascarado.',
  },
  {
    name: 'session_token_hash',
    dataType: 'text',
    piiType: 'CREDENTIAL',
    policy: 'REDACTED',
    reason: 'Credencial: no se sirve nunca en claro.',
  },
  { name: 'open_case_count', dataType: 'integer', piiType: null, policy: 'PLAIN', reason: null },
];

const TOTAL = 240;
const TAMANO = 100;

function filas(pagina: number) {
  const desde = (pagina - 1) * TAMANO;
  const cuantas = Math.max(0, Math.min(TAMANO, TOTAL - desde));
  return Array.from({ length: cuantas }, (_, indice) => {
    const numero = desde + indice + 1;
    return {
      customer_id: `cliente-${numero}`,
      status: numero % 3 === 0 ? 'SUSPENDED' : 'ACTIVE',
      contact_email: `c${numero}••••@atlas.internal`,
      session_token_hash: '••••',
      open_case_count: numero % 5,
    };
  });
}

/** Historial en memoria: la prueba tiene que ver crecer la lista al ejecutar una celda. */
const historial: Record<string, unknown>[] = [];

export function limpiarHistorialSimulado(): void {
  historial.length = 0;
}

export async function mockDataNotebookBackend(page: Page): Promise<void> {
  await mockBackend(page);
  limpiarHistorialSimulado();

  await page.route('**/atlas-backend/data-notebook/history*', async (route) => {
    if (route.request().method() === 'POST') {
      const cuerpo = JSON.parse(route.request().postData() ?? '{}');
      // El simulado afirma lo mismo que el backend: si llegan resultados, se rechaza. Sin esta
      // comprobación la prueba pasaría contra un cliente que empezara a mandarlos.
      if ('rows' in cuerpo || 'result' in cuerpo) {
        await route.fulfill({ status: 400, json: { error: { code: 'VALIDATION_ERROR' } } });
        return;
      }
      historial.unshift({
        id: String(historial.length + 1),
        language: cuerpo.language,
        source: cuerpo.source,
        datasetCode: cuerpo.datasetCode ?? null,
        datasetPage: cuerpo.datasetPage ?? null,
        rowCount: cuerpo.rowCount ?? null,
        durationMs: cuerpo.durationMs ?? null,
        status: cuerpo.status,
        errorMessage: cuerpo.errorMessage ?? null,
        createdAt: '2026-08-14T20:00:00.000Z',
      });
      await route.fulfill({ json: { id: String(historial.length) } });
      return;
    }
    await route.fulfill({ json: historial });
  });

  await page.route('**/atlas-backend/data-notebook/datasets', async (route) => {
    await route.fulfill({ json: CATALOGO });
  });

  await page.route('**/atlas-backend/data-notebook/datasets/*/rows*', async (route) => {
    const url = new URL(route.request().url());
    const pagina = Number(url.searchParams.get('page') ?? '1');
    const codigo = url.pathname.split('/').at(-2) ?? 'customer-overview';
    const dataset =
      CATALOGO.datasets.find((candidato) => candidato.code === codigo) ?? CATALOGO.datasets[0];

    await route.fulfill({
      json: {
        dataset: { code: dataset.code, label: dataset.label, view: dataset.view },
        columns: COLUMNAS,
        rows: filas(pagina),
        page: pagina,
        pageSize: TAMANO,
        total: TOTAL,
        totalIsExact: true,
        masked: true,
      },
    });
  });
}
