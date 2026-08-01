import { expect, test, type Page } from '@playwright/test';
import { denseBackend } from './support/dense-backend';
import {
  AA_FLOOR,
  SAMPLE_ROUTES,
  SWEEP_TIMEOUT_MS,
  describeOffenders,
  lowContrastNodes,
  type Offender,
} from './support/contrast-probe';

/**
 * Contraste con las tablas llenas.
 *
 * Los otros barridos miden contra el motor simulado normal, que devuelve
 * listados vacíos: enseñan cabecera, barra de herramientas y estado vacío, y
 * poco más. Todo el color que vive DENTRO de una tabla —insignias de estado,
 * códigos monoespaciados, celdas truncadas, filas alternas— se quedaba sin
 * medir, y es precisamente donde más fácil se queda una regla a medias.
 *
 * Aquí las filas llegan llenas, con las doce variantes de estado repartidas y
 * con textos que desbordan su celda a propósito.
 */

/** Filas mínimas que deben haberse pintado: cero significaría medir el vacío. */
const MIN_ROWS = 5;

async function measure(page: Page, theme: 'dark' | 'light') {
  test.setTimeout(SWEEP_TIMEOUT_MS);
  await denseBackend(page);
  await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), theme);

  const offenders: (Offender & { route: string })[] = [];
  const emptyTables: string[] = [];
  for (const route of SAMPLE_ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('#main-content')).toContainText(/\S/, { timeout: 60_000 });
    await page.waitForTimeout(700);

    // No toda vista es una tabla (el editor de grafo no lo es); sólo se exige
    // densidad donde de verdad hay una.
    const hasTable = (await page.locator('table').count()) > 0;
    if (hasTable) {
      // Se espera a que la tabla SE LLENE, no a un plazo fijo: 700 ms bastan con la
      // máquina ociosa y no cuando la ruta se compila al vuelo, y entonces la prueba
      // acusaba de vacía una tabla que sólo iba tarde. El `catch` deja intacto el caso
      // que de verdad importa: si nunca se llena, se registra abajo y la prueba falla.
      await page
        .locator('tbody tr')
        .nth(MIN_ROWS - 1)
        .waitFor({ timeout: 30_000 })
        .catch(() => undefined);
    }

    const rows = await page.locator('tbody tr').count();
    if (hasTable && rows < MIN_ROWS) emptyTables.push(`${route} (${rows} filas)`);

    const { offenders: found } = await lowContrastNodes(page, AA_FLOOR);
    for (const offender of found) offenders.push({ ...offender, route });
  }

  expect(
    emptyTables,
    `Tablas que no llegaron a llenarse, así que no se midió nada dentro: ${emptyTables.join(', ')}`,
  ).toEqual([]);
  expect(
    offenders,
    `Texto por debajo de ${AA_FLOOR}:1 con las tablas llenas en tema ${theme}:\n` +
      describeOffenders(offenders),
  ).toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  const label = theme === 'dark' ? 'oscuro' : 'claro';
  test(`ningún texto queda ilegible con datos reales en tema ${label}`, async ({ page }) => {
    await measure(page, theme);
  });
}
