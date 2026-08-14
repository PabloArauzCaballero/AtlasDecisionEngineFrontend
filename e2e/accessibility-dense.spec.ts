import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { denseBackend } from './support/dense-backend';
import { SAMPLE_ROUTES, SWEEP_TIMEOUT_MS } from './support/contrast-probe';

/**
 * Accesibilidad con las tablas LLENAS.
 *
 * `accessibility.spec.ts` recorre las 25 rutas contra el motor simulado normal,
 * que devuelve listados vacíos: mide cabecera, barra de herramientas y estado
 * vacío. Todo lo que sólo existe cuando hay filas —los botones de acción por
 * fila, la paginación, las cabeceras ordenables, las insignias de estado, los
 * menús de cada registro— nunca pasaba por axe. Es la misma trampa que el
 * repositorio ya había identificado para el contraste, y por la que existe
 * `dense-backend.ts` y `contrast-dense.spec.ts`; el barrido de accesibilidad se
 * añadió después y se quedó fuera del arreglo.
 *
 * Va en especificación aparte y no como un tercer tema del barrido normal para
 * que un fallo diga por sí solo si se rompió la vista o se rompió la fila.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Reglas suspendidas, con motivo y fecha. Vacío a propósito (ver el barrido normal). */
const SUSPENDED: string[] = [];

/** Filas mínimas para dar la vista por poblada: cero sería medir el vacío otra vez. */
const MIN_ROWS = 5;

async function settle(page: Page, route: string): Promise<number> {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Señal POSITIVA de vista montada, nunca una espera a plazo fijo: analizar una
  // pantalla en blanco devuelve cero incumplimientos, que se lee igual que «no
  // hay incumplimientos».
  await expect(page.locator('#main-content')).toContainText(/\S/, { timeout: 60_000 });

  if ((await page.locator('table').count()) === 0) return -1;
  await page
    .locator('tbody tr')
    .nth(MIN_ROWS - 1)
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  return page.locator('tbody tr').count();
}

for (const theme of ['light', 'dark'] as const) {
  const label = theme === 'dark' ? 'oscuro' : 'claro';

  test(`ninguna vista POBLADA incumple WCAG 2.1 AA detectable en tema ${label}`, async ({
    page,
  }) => {
    test.setTimeout(SWEEP_TIMEOUT_MS);
    await denseBackend(page);
    await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), theme);

    const report: string[] = [];
    const empty: string[] = [];

    for (const route of SAMPLE_ROUTES) {
      const rows = await settle(page, route);
      // -1 = la vista no es una tabla (el editor de grafo, el simulador).
      if (rows >= 0 && rows < MIN_ROWS) empty.push(`${route} (${rows} filas)`);

      const { violations } = await new AxeBuilder({ page })
        .withTags(TAGS)
        .disableRules(SUSPENDED)
        .analyze();

      for (const violation of violations) {
        report.push(
          `  ${route} · [${violation.impact ?? 'n/d'}] ${violation.id}: ${violation.help}\n` +
            violation.nodes
              .slice(0, 4)
              .map((node) => `      ${String(node.target)}`)
              .join('\n'),
        );
      }
    }

    // Se comprueba ANTES que los incumplimientos: si las tablas llegaron vacías,
    // un informe limpio no significa nada y decirlo así ahorra la investigación.
    expect(
      empty,
      `Estas vistas no se poblaron, así que el barrido no midió lo que dice medir:\n${empty.join('\n')}`,
    ).toEqual([]);
    expect(report, `Incumplimientos con datos, tema ${label}:\n${report.join('\n')}`).toEqual([]);
  });
}
