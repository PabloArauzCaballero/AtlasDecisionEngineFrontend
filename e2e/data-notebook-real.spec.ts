import { expect, test, type Page } from '@playwright/test';
import { MOCK_SESSION, mockBackend } from './support/backend-mock';

/**
 * El cuaderno contra AtlasBackend DE VERDAD, sin simular ni una respuesta suya.
 *
 * Es la prueba que le faltaba a esta batería, y la ausencia era del tipo que no se nota: las otras
 * veintiuna interceptan `/atlas-backend/**` con `page.route`, así que verifican que la vista sabe
 * pintar la forma que este repositorio CREE que el backend sirve. Ninguna verifica que esa creencia
 * sea cierta, ni que el navegador llegue hasta allí — el proxy, la red de Docker, los permisos y el
 * token de sesión se quedaban todos fuera del alcance.
 *
 * Aquí sólo se simula la SESIÓN, que es lo que no se puede fabricar sin credenciales: se inyecta un
 * token emitido por el propio AtlasBackend en la respuesta de `/v1/session/**` (que va al motor).
 * El resto viaja por el camino real: `/atlas-backend/*` sale del navegador, atraviesa el proxy del
 * portal y llega al backend, que decide con sus propios roles.
 *
 * Sin `PW_BACKEND_TOKEN` se salta entera: una prueba roja por falta de configuración no informa de
 * ningún defecto. Para generarlo:
 *
 *   cd ../AtlasBackend && npx tsx scripts/create-dev-jwt.ts --role=admin --tenant-id=1
 */

const RUTA = '/data-notebook';
const TOKEN = process.env.PW_BACKEND_TOKEN?.trim();

/** Sesión del portal con un token que AtlasBackend acepta de verdad. */
async function abrirConSesionReal(page: Page) {
  await mockBackend(page);

  // Se registra DESPUÉS de `mockBackend` a propósito: Playwright prueba las rutas de la última a
  // la primera, así que ésta gana sobre el `**/v1/**` genérico y cambia sólo la sesión.
  await page.route('**/v1/session/**', (route) =>
    route.fulfill({ json: { ...MOCK_SESSION, accessToken: TOKEN } }),
  );

  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.notebook')).toBeVisible({ timeout: 30_000 });

  /*
   * Se ELIGE el dataset en vez de confiar en el que salga primero.
   *
   * Esta prueba se clavó al orden del catálogo y se rompió el día que se le sumaron los datasets
   * del motor: seguía cargando datos reales —la bitácora de auditoría— pero buscaba un cliente en
   * ellos. El fallo no decía «cambió el orden», decía «no encuentro CUS-DEMO-001», que manda a
   * buscar el defecto donde no está.
   */
  await page.locator('.notebook-dataset__picker select').selectOption('customer-overview');
  await expect(page.locator('.notebook-dataset .notebook-table tbody tr').first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('cuaderno de datos · AtlasBackend real', () => {
  test.skip(!TOKEN, 'Requiere PW_BACKEND_TOKEN (ver la cabecera de este archivo).');
  test.slow();

  test('la tabla trae filas reales de read_api, no del simulado', async ({ page }) => {
    await abrirConSesionReal(page);

    const tabla = page.locator('.notebook-dataset .notebook-table');
    await expect(tabla).toBeVisible({ timeout: 30_000 });

    // `CUS-DEMO-001` está en la base sembrada y NO existe en ningún simulado de este repositorio:
    // si aparece, el dato cruzó el proxy y vino de Postgres.
    await expect(tabla).toContainText('CUS-DEMO-001', { timeout: 30_000 });
    await expect(tabla.locator('thead th').filter({ hasText: 'lifecycle_status' })).toBeVisible();
  });

  /**
   * Los siete de AtlasBackend, por CÓDIGO y no por posición ni por cuántos hay en total.
   *
   * Antes se afirmaba `codigos.length === 7` y se rompió en cuanto el catálogo sumó los datasets
   * del motor: una prueba que cuenta lo que hay se rompe cada vez que alguien añade algo legítimo,
   * y su rojo no distingue «falta un dataset» de «hay uno nuevo». Nombrándolos, sólo falla si uno
   * de los que ESTA prueba cubre deja de responder — que es lo único que quiere detectar.
   */
  const DATASETS_DE_ATLASBACKEND = [
    'customer-overview',
    'risk-assessment-summary',
    'operations-work-queue',
    'provider-health-latest',
    'notification-delivery-summary',
    'system-endpoint-coverage',
    'audit-event-feed',
  ];

  test('los siete datasets de AtlasBackend responden', async ({ page }) => {
    await abrirConSesionReal(page);

    const selector = page.locator('.notebook-dataset__picker select');
    const codigos = await selector
      .locator('option')
      .evaluateAll((opciones) => opciones.map((opcion) => (opcion as HTMLOptionElement).value));
    expect(codigos).toEqual(expect.arrayContaining(DATASETS_DE_ATLASBACKEND));

    for (const codigo of DATASETS_DE_ATLASBACKEND) {
      await selector.selectOption(codigo);
      // El fallo que esto atrapa es el de un dataset que responde 503 —le falta la columna de
      // inquilino, la vista no existe— y deja la pantalla con un error en vez de una tabla.
      await expect(page.locator('.notebook-dataset__error')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator('.notebook-dataset .notebook-table')).toBeVisible({
        timeout: 30_000,
      });
    }
  });

  test('Python analiza los datos reales con pandas', async ({ page }) => {
    await abrirConSesionReal(page);
    await expect(page.locator('.notebook-dataset .notebook-table')).toBeVisible({
      timeout: 30_000,
    });

    await page
      .locator('.notebook-cell__code')
      .first()
      .fill('df.groupby("lifecycle_status").size().reset_index(name="cuantos")');
    await page.locator('.notebook-cell__run').first().click();

    const salida = page.locator('.notebook-cell__output').first();
    await expect(salida).toBeVisible({ timeout: 240_000 });
    await expect(salida.locator('.notebook-table tbody tr').first()).toBeVisible();
    // `active` es el estado de los clientes sembrados: el agrupado salió de los datos, no de nada
    // que esta prueba haya escrito.
    await expect(salida).toContainText('active');
  });

  test('el historial registra contra la base real', async ({ page }) => {
    await abrirConSesionReal(page);
    await expect(page.locator('.notebook-dataset .notebook-table')).toBeVisible({
      timeout: 30_000,
    });

    const marca = `# real ${Date.now()}`;
    await page
      .locator('.notebook-cell__language')
      .first()
      .locator('select')
      .selectOption('javascript');
    await page.locator('.notebook-cell__code').first().fill(`${marca}\nreturn rows.slice(0, 2);`);
    await page.locator('.notebook-cell__run').first().click();
    await expect(page.locator('.notebook-cell__output').first()).toBeVisible({ timeout: 30_000 });

    await expect(page.locator('.notebook-history__source').first()).toContainText(marca, {
      timeout: 30_000,
    });
  });
});

test.describe('cuaderno de datos · evidencia con datos reales', () => {
  test.skip(!TOKEN, 'Requiere PW_BACKEND_TOKEN (ver la cabecera de este archivo).');
  test.slow();

  test('captura la pantalla sirviendo read_api', async ({ page }) => {
    await abrirConSesionReal(page);
    const tabla = page.locator('.notebook-dataset .notebook-table');
    await expect(tabla).toContainText('CUS-DEMO-001', { timeout: 30_000 });

    // La captura va después de la aserción: la foto sólo existe si lo que muestra es cierto.
    await page.locator('.notebook-dataset__head').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'docs/visual-evidence/cuaderno/05-datos-reales-atlasbackend.png',
      animations: 'disabled',
    });
  });
});
