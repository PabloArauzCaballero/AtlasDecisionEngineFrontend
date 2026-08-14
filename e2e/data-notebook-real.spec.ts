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

const RUTA = '/workers/data-notebook';
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

  test('los siete datasets del catálogo responden', async ({ page }) => {
    await abrirConSesionReal(page);

    const selector = page.locator('.notebook-dataset__picker select');
    const codigos = await selector
      .locator('option')
      .evaluateAll((opciones) => opciones.map((opcion) => (opcion as HTMLOptionElement).value));
    expect(codigos.length).toBe(7);

    for (const codigo of codigos) {
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
