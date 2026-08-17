import { expect, type Page } from '@playwright/test';
import { mockBackend } from './backend-mock';

/**
 * AtlasBackend envuelve TODA respuesta en .
 *
 * El simulado devolvia el objeto PELADO, o sea una forma que el backend nunca produce, y por eso
 * veintiuna pruebas pasaron en verde sobre un camino que en el navegador fallaba siempre con «No
 * fue posible leer el catalogo». Un simulado que no imita la forma real no prueba la integracion:
 * prueba que la pantalla sabe pintar lo que el propio simulado inventó.
 */
function sobre(data: unknown) {
  return { requestId: 'e2e-cuaderno', data, timestamp: '2026-08-14T20:00:00.000Z' };
}

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

/**
 * Cuadernos guardados, en memoria y con la misma regla que el backend.
 *
 * El simulado exige lo mismo que el `.strict()` de Zod del backend: si una celda trae resultado,
 * ese resultado tiene que traer `savedAt`. Sin esa comprobación aquí, la prueba seguiría en verde
 * el día que el cliente dejara de sellar la fecha — y entonces un número de la semana pasada se
 * pintaría sin rótulo, indistinguible de uno recién calculado.
 */
const cuadernos: Record<string, unknown>[] = [];
let siguienteId = 1;

export function limpiarCuadernosSimulados(): void {
  cuadernos.length = 0;
  siguienteId = 1;
}

function documento(cuerpo: Record<string, unknown>, id: string) {
  return {
    id,
    title: cuerpo.title,
    datasetCode: cuerpo.datasetCode ?? null,
    cells: cuerpo.cells,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  };
}

async function mockCuadernos(page: Page): Promise<void> {
  await page.route('**/atlas-backend/data-notebook/notebooks', async (route) => {
    if (route.request().method() === 'POST') {
      const cuerpo = JSON.parse(route.request().postData() ?? '{}');
      const celdas = Array.isArray(cuerpo.cells) ? cuerpo.cells : [];
      const sinFecha = celdas.some((celda: { outcome?: { savedAt?: string } | null }) => {
        return Boolean(celda.outcome) && !celda.outcome?.savedAt;
      });
      if (sinFecha) {
        await route.fulfill({ status: 400, json: { error: { code: 'VALIDATION_ERROR' } } });
        return;
      }
      const creado = documento(cuerpo, String(siguienteId));
      siguienteId += 1;
      cuadernos.unshift(creado);
      await route.fulfill({ status: 201, json: sobre(creado) });
      return;
    }
    await route.fulfill({
      json: sobre(
        cuadernos.map((cuaderno) => ({
          id: cuaderno.id,
          title: cuaderno.title,
          datasetCode: cuaderno.datasetCode,
          cellCount: Array.isArray(cuaderno.cells) ? cuaderno.cells.length : 0,
          createdAt: cuaderno.createdAt,
          updatedAt: cuaderno.updatedAt,
        })),
      ),
    });
  });

  await page.route('**/atlas-backend/data-notebook/notebooks/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    const indice = cuadernos.findIndex((cuaderno) => cuaderno.id === id);

    if (route.request().method() === 'DELETE') {
      if (indice >= 0) cuadernos.splice(indice, 1);
      await route.fulfill({ json: sobre({ deleted: indice >= 0 }) });
      return;
    }

    if (route.request().method() === 'PUT') {
      const cuerpo = JSON.parse(route.request().postData() ?? '{}');
      const actualizado = documento(cuerpo, id);
      if (indice >= 0) cuadernos[indice] = actualizado;
      await route.fulfill({ json: sobre(actualizado) });
      return;
    }

    if (indice < 0) {
      await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
      return;
    }
    await route.fulfill({ json: sobre(cuadernos[indice]) });
  });
}

export async function mockDataNotebookBackend(page: Page): Promise<void> {
  await mockBackend(page);
  limpiarHistorialSimulado();
  limpiarCuadernosSimulados();
  await mockCuadernos(page);

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
      await route.fulfill({ json: sobre({ id: String(historial.length) }) });
      return;
    }
    /*
     * `{ rows, total }` y NO el array pelado que servía antes.
     *
     * El cliente valida la respuesta con `notebookHistoryPageSchema`, que exige
     * las dos claves —`total` es lo que permite paginar, y sin él no se sabe si
     * hay una página más—. Con el array suelto la validación fallaba y el panel
     * pintaba «No se pudo leer el historial» **con un HTTP 200 delante**, que es
     * la clase de fallo que manda a mirar la red durante media hora.
     *
     * Se respetan `limit` y `offset` por lo mismo que se respeta el resto del
     * contrato: un simulado que devuelve siempre todo deja sin ejercitar el
     * paginador, que es justo lo que estas pruebas dicen comprobar.
     */
    const consulta = new URL(route.request().url()).searchParams;
    const desde = Number(consulta.get('offset') ?? 0);
    const cuantas = Number(consulta.get('limit') ?? historial.length);
    await route.fulfill({
      json: sobre({ rows: historial.slice(desde, desde + cuantas), total: historial.length }),
    });
  });

  await page.route('**/atlas-backend/data-notebook/datasets', async (route) => {
    await route.fulfill({ json: sobre(CATALOGO) });
  });

  await page.route('**/atlas-backend/data-notebook/datasets/*/rows*', async (route) => {
    const url = new URL(route.request().url());
    const pagina = Number(url.searchParams.get('page') ?? '1');
    const codigo = url.pathname.split('/').at(-2) ?? 'customer-overview';
    const dataset =
      CATALOGO.datasets.find((candidato) => candidato.code === codigo) ?? CATALOGO.datasets[0];

    await route.fulfill({
      json: sobre({
        dataset: { code: dataset.code, label: dataset.label, view: dataset.view },
        columns: COLUMNAS,
        rows: filas(pagina),
        page: pagina,
        pageSize: TAMANO,
        total: TOTAL,
        totalIsExact: true,
        masked: true,
        bytes: 1024,
        droppedRows: 0,
      }),
    });
  });
}

/**
 * Entra a un cuaderno de trabajo, pasando por la portada.
 *
 * Desde que el cuaderno son DOS pantallas —elegir y trabajar—, ir directo a `/data-notebook` deja
 * la lista, no el editor. Este ayudante hace el viaje completo para que cada batería no lo repita
 * y, sobre todo, para que el día que el flujo cambie haya UN sitio que arreglar.
 */
export async function abrirCuadernoDeTrabajo(
  page: Page,
  nombre = 'Cuaderno de prueba',
): Promise<void> {
  await page.goto('/data-notebook', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.notebook-index')).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder('Nombre del cuaderno nuevo').fill(nombre);
  await page.getByRole('button', { name: 'Nuevo cuaderno' }).click();
  await expect(page).toHaveURL(/\/data-notebook\/\d+$/, { timeout: 30_000 });
  await expect(page.locator('.notebook')).toBeVisible({ timeout: 30_000 });
}
