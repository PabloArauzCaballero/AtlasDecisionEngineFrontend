import { expect, test, type Page } from '@playwright/test';
import { AA_FLOOR, describeOffenders, lowContrastNodes } from './support/contrast-probe';
import type { Offender } from './support/contrast-probe';
import { governanceBackend } from './support/governance-backend';

/**
 * Las pantallas de gobierno, con datos de verdad.
 *
 * Las barridas de contraste y de desbordamiento recorren rutas de LISTADO. Las
 * superficies nuevas de gobierno —el diff estructural, la versión vigente por
 * ambiente, el aviso de invariante rota, el diálogo de firma— viven en rutas de
 * DETALLE y sólo existen cuando el backend devuelve objetos, no páginas. Contra
 * el motor simulado normal no se pinta ninguna, así que ninguna se estaba
 * midiendo: se habría medido una cabecera creyendo medir la vista.
 *
 * Aquí se comprueban las tres cosas que importan de esas superficies: que
 * aparecen, que se leen en los DOS temas y que no empujan la página.
 */

/*
 * La pestaña de versiones se pide por URL (`?tab=`, ver `useTabParam`): el diff
 * de la ficha vive detrás de ella, y sin abrirla se mediría el resumen creyendo
 * medir la pestaña entera.
 */
const ROUTES = ['/approval-requests/31', '/artifacts/1', '/artifacts/1?tab=versions'] as const;

async function open(page: Page, route: string, theme: 'light' | 'dark') {
  await governanceBackend(page);
  await page.addInitScript((value) => window.localStorage.setItem('atlas.theme', value), theme);
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#main-content')).toContainText(/\S/);
}

test.describe('detalle de aprobación', () => {
  test('el diff estructural nombra cada cambio en vez de decorar el panel', async ({ page }) => {
    await open(page, '/approval-requests/31', 'light');

    // La ruta del cambio, no un texto genérico: es lo que distingue este panel
    // del bloque decorativo que sustituyó.
    await expect(page.getByText('nodes.EVAL_SCORE.label')).toBeVisible();
    await expect(page.getByText('Evalúa score de buró')).toBeVisible();
    await expect(page.getByText('Evalúa score y capacidad')).toBeVisible();
    await expect(page.getByText('nodes.REVISION')).toBeVisible();
    await expect(page.getByText('nodes.RECHAZO')).toBeVisible();
    // Mover el nodo no es lógica, y la vista lo dice en vez de mezclarlo.
    await expect(page.getByText('sólo presentación').first()).toBeVisible();
  });

  test('un gate en rojo se pinta como tal y no como aprobado', async ({ page }) => {
    await open(page, '/approval-requests/31', 'light');

    await expect(page.getByText('Suite bloqueante')).toBeVisible();
    await expect(page.getByText('2 casos en rojo')).toBeVisible();
    await expect(page.locator('.gate-list li[data-passing="no"]')).toHaveCount(1);
  });

  test('avisa de que producción avanzó por debajo de la versión en revisión', async ({ page }) => {
    await open(page, '/approval-requests/31', 'light');

    await expect(page.getByText(/el objetivo avanzó/)).toBeVisible();
  });

  test('firmar exige confirmación y enseña la consecuencia', async ({ page }) => {
    await open(page, '/approval-requests/31', 'light');

    await page.locator('textarea').fill('Revisado con el equipo de riesgo.');
    await page.getByRole('button', { name: /Aprobar Despliegue/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('SCORING_CREDITO_CONSUMO');
    await expect(dialog).toContainText('No podrás deshacerlo desde el portal');
    // La evidencia incompleta se advierte ANTES de firmar, no después.
    await expect(dialog).toContainText(/no están en estado aprobado/);

    const offenders = await lowContrastNodes(page, AA_FLOOR);
    expect(
      offenders.offenders.length,
      describeOffenders(offenders.offenders.map((o: Offender) => ({ ...o, route: 'diálogo' }))),
    ).toBe(0);
  });
});

test.describe('ficha del artefacto', () => {
  test('delata dos versiones activas en el mismo ambiente', async ({ page }) => {
    await open(page, '/artifacts/1', 'light');

    await expect(page.locator('.environment-heads li[data-conflict="yes"]')).toHaveCount(1);
    await expect(page.getByText('2 activas')).toBeVisible();
    await expect(page.getByText(/sólo puede tener una/)).toBeVisible();
    // Y ya no llama «versión actual gobernada» a la última del historial.
    await expect(page.getByText('Última versión del historial')).toBeVisible();
  });

  test('la pestaña de versiones compara la última contra la anterior', async ({ page }) => {
    await open(page, '/artifacts/1?tab=versions', 'light');

    await expect(page.getByText(/Comparando/)).toBeVisible();
    await expect(page.getByText('nodes.EVAL_SCORE.label')).toBeVisible();
  });
});

for (const theme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`${route} se lee en tema ${theme}`, async ({ page }) => {
      await open(page, route, theme);
      await page.waitForTimeout(500);

      const { offenders, inspected } = await lowContrastNodes(page, AA_FLOOR);
      // Un cero delataría que se midió una página que nunca se pintó.
      expect(inspected, `${route} no pintó texto que medir`).toBeGreaterThan(20);
      expect(
        offenders.length,
        describeOffenders(offenders.map((o: Offender) => ({ ...o, route }))),
      ).toBe(0);
    });
  }
}

// El desbordamiento no depende del tema, así que se mide una vez por ruta: el
// diff trae rutas largas (`nodes.EVAL_SCORE.label`) y valores JSON, que son
// justo lo que empuja la página si algo no se recorta.
for (const route of ROUTES) {
  test(`${route} no desborda en móvil`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page, route, 'light');
    await page.waitForTimeout(500);

    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scroll,
      `${route} desborda ${overflow.scroll - overflow.client}px`,
    ).toBeLessThanOrEqual(overflow.client + 1);
  });
}
