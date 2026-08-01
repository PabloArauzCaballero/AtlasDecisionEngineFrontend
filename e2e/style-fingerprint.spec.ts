import { test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { mockBackend } from './support/backend-mock';

/**
 * Huella de los estilos ya calculados, para refactorizar CSS sin fe.
 *
 * No es una prueba con criterio propio: es una herramienta. Recorre las rutas en
 * un tema y anota el color, el fondo y el borde EFECTIVOS de cada elemento. Se
 * ejecuta antes y después de un cambio de hojas y se comparan los dos ficheros;
 * si son idénticos, el cambio es demostrablemente inocuo.
 *
 *   PW_FINGERPRINT=antes.json npx playwright test e2e/style-fingerprint.spec.ts
 *   …se edita el CSS…
 *   PW_FINGERPRINT=despues.json npx playwright test e2e/style-fingerprint.spec.ts
 *   node -e "…comparar…"
 *
 * Se salta si no se le pide destino, para no ralentizar la suite normal.
 */
const OUT = process.env.PW_FINGERPRINT;
const THEME = (process.env.PW_FINGERPRINT_THEME ?? 'dark') as 'dark' | 'light';

const ROUTES = [
  '/platform-health',
  '/artifacts',
  '/variables',
  '/executions',
  '/reviews',
  '/test-suites',
  '/deployments',
  '/objectives',
  '/simulator',
  '/graph-editor',
  '/calculated-fields',
  '/qa-lab',
];

async function fingerprint(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rows: string[] = [];
    document.body.querySelectorAll('*').forEach((element, index) => {
      const s = getComputedStyle(element);
      const classes = [...element.classList].join('.');
      rows.push(
        [
          index,
          element.tagName.toLowerCase(),
          classes,
          s.color,
          s.backgroundColor,
          s.borderTopColor,
          s.borderBottomColor,
          s.stroke,
          s.fill,
        ].join('|'),
      );
    });
    return rows;
  });
}

test('huella de estilos calculados', async ({ page }) => {
  test.skip(!OUT, 'Sólo corre cuando se pide con PW_FINGERPRINT.');
  test.setTimeout(180_000);
  await mockBackend(page);
  await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), THEME);

  const all: Record<string, string[]> = {};
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('#main-content').first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(700);
    all[route] = await fingerprint(page);
  }
  writeFileSync(OUT!, JSON.stringify(all, null, 1));
});
