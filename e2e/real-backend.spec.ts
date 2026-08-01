import { expect, test, type Page, type Route } from '@playwright/test';
import { collectProblems, MOCK_SESSION } from './support/backend-mock';

/**
 * Pasada contra el Decision Engine real.
 *
 * Las demás especificaciones simulan el backend, así que sólo prueban las formas
 * de datos que el propio repositorio inventa. Esta recorre las vistas nuevas con
 * los datos de verdad: volúmenes reales, campos que el motor rellena y campos
 * que deja en null, listados vacíos y endpoints que en esta versión del motor
 * todavía no existen.
 *
 * Es opt-in y no guarda ningún secreto: se activa con la clave de gestión del
 * entorno local en `PW_MANAGEMENT_KEY`. Sin esa variable se salta al instante.
 *
 *   PW_MANAGEMENT_KEY=<clave> yarn playwright test e2e/real-backend.spec.ts
 *
 * La sesión se forja porque los usuarios viven en el proveedor de identidad, que
 * es un servicio aparte; la autorización real la aporta la clave de gestión, que
 * el interceptor añade a cada petición.
 */

const KEY = process.env.PW_MANAGEMENT_KEY;

const ROUTES = [
  '/platform-health',
  '/actions',
  '/artifacts',
  '/deployments',
  '/environments',
  '/executions',
  '/audit-events',
  '/test-suites',
  '/graph-editor',
  '/simulator',
  '/manual-reviews',
  '/reviews',
  '/objectives',
  '/coverage-matrix',
];

/**
 * Enruta todo `/v1` al motor real añadiendo la clave de gestión, salvo la
 * sesión, que se forja.
 *
 * El orden importa: Playwright evalúa las rutas de la última registrada a la
 * primera, así que el patrón de sesión debe registrarse DESPUÉS del genérico
 * para ganarle. Al revés, la restauración de sesión viajaría al motor, éste la
 * rechazaría por no venir de un usuario del proveedor de identidad y el portal
 * se quedaría en el acceso.
 */
async function useRealBackend(page: Page): Promise<void> {
  const withKey = (headers: Record<string, string>) => {
    // El portal manda el `Authorization` de la sesión forjada. Hay que quitarlo:
    // si el motor ve un Bearer lo valida contra el proveedor de identidad, falla
    // y ni siquiera mira la clave de gestión.
    const { authorization, Authorization, ...rest } = headers;
    void authorization;
    void Authorization;
    return { ...rest, 'x-api-key': KEY as string };
  };
  const forward = (route: Route) => route.continue({ headers: withKey(route.request().headers()) });

  await page.route('**/v1/**', forward);
  await page.route('**/health/**', forward);
  await page.route('**/v1/session/**', (route) => route.fulfill({ json: MOCK_SESSION }));
}

test.describe('backend real', () => {
  test.skip(!KEY, 'Define PW_MANAGEMENT_KEY (con el motor levantado) para ejecutarla.');

  test('las vistas renderizan datos reales sin errores de cliente', async ({ page }) => {
    test.setTimeout(300_000);
    const problems = collectProblems(page);

    await useRealBackend(page);

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.locator('.app-main').first().waitFor({ timeout: 30_000 });
      // Deja asentar las consultas: es donde afloran los fallos por formas de
      // datos que el mock no reproduce (campos null, listas vacías, 404).
      await page.waitForTimeout(600);
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('el panel de inicio resuelve sus métricas contra el motor', async ({ page }) => {
    test.setTimeout(180_000);
    await useRealBackend(page);

    await page.goto('/platform-health', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.dash-grid')).toBeVisible({ timeout: 30_000 });

    // Espera a que el motor responda de verdad. En desarrollo la primera
    // petición a cada ruta del proxy compila su manejador, así que el panel
    // tarda unos segundos en dejar de mostrar guiones.
    await expect
      .poll(
        async () => {
          const values = await page.locator('.dash-card > strong').allInnerTexts();
          return values.filter((value) => /\d/.test(value)).length;
        },
        { timeout: 60_000, message: 'ninguna tarjeta llegó a mostrar un número real' },
      )
      .toBeGreaterThan(0);

    // Cada tarjeta muestra un número real o un guion explicado; lo que nunca
    // debe aparecer es un hueco en blanco ni un "NaN".
    const values = await page.locator('.dash-card > strong').allInnerTexts();
    expect(values).toHaveLength(8);
    for (const value of values) {
      // El contador duplica el valor para el lector de pantalla (uno visible y
      // otro sólo audible), así que se comprueba la primera línea.
      const shown = value.split('\n')[0].trim();
      expect(shown).not.toBe('');
      expect(shown).not.toContain('NaN');
      expect(shown).toMatch(/^(—|[\d.,]+(\s%)?)$/);
    }

    await page.screenshot({
      path: 'docs/visual-evidence/12-panel-inicio-datos-reales.png',
      fullPage: true,
      // Adelanta las animaciones de entrada al estado final: sin esto la captura
      // congela paneles y filas desplegadas en su fotograma inicial, invisible.
      animations: 'disabled',
    });
  });

  test('el editor lee las variables reales de condiciones y acciones', async ({ page }) => {
    test.setTimeout(180_000);
    await useRealBackend(page);

    // Se abre una versión real del motor, cuyas condiciones y acciones guardan
    // su lógica como árbol JSON: es justo lo que el editor no sabía leer. No sirve
    // la primera del selector sin más: el catálogo sembrado incluye demos sin grafo
    // (p. ej. el de contratos), y abrir una versión sin nodos dejaría al editor sin
    // nada que pintar. Se busca la primera versión que de verdad tenga nodos.
    const versions = await page.request.get('/v1/views/pickers/artifact-versions', {
      headers: { 'x-api-key': KEY as string },
    });
    const candidates = (await versions.json()) as Array<{ id: string | number }>;
    let versionId = '';
    for (const candidate of candidates) {
      const graph = await page.request.get(`/v1/artifact-versions/${candidate.id}/graph`, {
        headers: { 'x-api-key': KEY as string },
      });
      const body = (await graph.json().catch(() => ({}))) as { nodes?: unknown[] };
      if (Array.isArray(body.nodes) && body.nodes.length > 0) {
        versionId = String(candidate.id);
        break;
      }
    }
    expect(versionId, 'no hay ninguna versión con grafo en el catálogo sembrado').not.toBe('');

    await page.goto(`/artifact-versions/${versionId}/graph`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.locator('.graph-node').first().waitFor({ timeout: 60_000 });

    // El catálogo de acciones existe y, al abrirlo, dice qué implica cada una.
    await page.getByRole('button', { name: /Acciones/ }).click();
    await expect(page.locator('.action-card').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.action-implies').first()).not.toBeEmpty();

    // El inicio ya no dice "no lee ninguna variable": recibe las declaradas.
    await page.locator('.graph-node').first().click();
    await expect(page.locator('.node-io-panel')).toBeVisible({ timeout: 30_000 });
    const reads = await page.locator('.node-io-in li').count();
    expect(reads).toBeGreaterThan(0);

    await page.screenshot({
      path: 'docs/visual-evidence/16-editor-datos-reales.png',
      fullPage: true,
      // Adelanta las animaciones de entrada al estado final: sin esto la captura
      // congela paneles y filas desplegadas en su fotograma inicial, invisible.
      animations: 'disabled',
    });
  });

  test('el banco de acciones reúne todos los algoritmos y deja aplicarlas', async ({ page }) => {
    test.setTimeout(180_000);
    await useRealBackend(page);

    // Sin elegir versión: el banco es global, ésa es toda la diferencia con el
    // anexo por algoritmo que había antes.
    await page.goto('/actions', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible({ timeout: 60_000 });
    const total = await page.locator('.data-table tbody tr').count();
    expect(total).toBeGreaterThan(0);

    // Cada fila dice en qué algoritmos existe: es lo que lo hace un banco y no
    // una lista suelta.
    await expect(page.locator('.data-table tbody tr').first()).toContainText(/\d+\.\d+\.\d+/);

    // El filtro por tipo reduce el listado sin recargar nada.
    await page.getByLabel('Filtrar acciones por tipo').selectOption('EMIT_REASON');
    await expect
      .poll(() => page.locator('.data-table tbody tr').count())
      .toBeLessThanOrEqual(total);

    // La fórmula vive en el detalle desplegable para no ensanchar la tabla, pero
    // sigue estando y con su valor real.
    await page.getByRole('button', { name: 'Ver el detalle completo' }).first().click();
    const detail = page.locator('.table-detail').first();
    await expect(detail).toBeVisible();
    await expect(detail.getByText('Cómo lo calcula')).toBeVisible();

    // Aplicar abre el formulario con la acción cargada y el algoritmo destino
    // elegible: el banco sirve para reutilizar, no sólo para mirar.
    await page
      .getByRole('button', { name: /^Aplicar o editar / })
      .first()
      .click();
    await expect(page.getByLabel('Algoritmo destino')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();

    // Pulsar en la última columna deja la tabla desplazada; se devuelve al
    // inicio para que la evidencia enseñe lo que ve quien entra a la página.
    await page
      .locator('.table-wrap')
      .first()
      .evaluate((element) => {
        element.scrollLeft = 0;
      });

    await captureBank(page);
  });

  test('importar código emite los motivos del catálogo como acción', async ({ page }) => {
    test.setTimeout(180_000);
    await useRealBackend(page);

    await page.goto('/code-import', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('button', { name: 'Analizar' }).click();

    // Cuando el literal que escribe una rama coincide con un reason code del
    // catálogo, el analizador genera la acción `EMIT_REASON` que lo emite. El
    // panel lo confirma antes de guardar: el resultado se podrá filtrar y
    // explicar por motivo, no sólo leerlo como una cadena suelta.
    const panel = page.locator('.import-bank');
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(panel).toContainText('AGE_NOT_ELIGIBLE');
    await expect(panel).toContainText(/ya emite \d+ motivos? del catálogo como acción/);

    // Y no queda ninguno suelto que el banco supiera hacer y el import ignore:
    // esa lista es exactamente lo que el motor ya no deja pendiente.
    await expect(page.locator('.import-bank-list li')).toHaveCount(0);
    // Sin nada pendiente, el panel no puede pedir que se declare lo que acaba de
    // emitir: decía las dos cosas a la vez y se contradecía.
    await expect(panel).not.toContainText('Ninguno de los valores');

    await page.screenshot({
      path: 'docs/visual-evidence/18-import-banco-acciones.png',
      fullPage: true,
      animations: 'disabled',
    });
  });
});

async function captureBank(page: Page): Promise<void> {
  await page.screenshot({
    path: 'docs/visual-evidence/17-catalogo-acciones.png',
    fullPage: true,
    // Adelanta las animaciones de entrada al estado final: sin esto la captura
    // congela paneles y filas desplegadas en su fotograma inicial, invisible.
    animations: 'disabled',
  });
}
