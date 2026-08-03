import { expect, test } from '@playwright/test';
import { mockBackend } from './support/backend-mock';
import { denseBackend } from './support/dense-backend';

/**
 * Mide sobre el DOM YA PINTADO los dos defectos visuales reportados.
 *
 * Se comprueba el estilo calculado, no la presencia de la regla en la hoja: una
 * regla puede estar servida y no aplicarse nunca por un selector que no encaja,
 * que es exactamente el error que se quiere descartar aquí.
 */
test.describe('defectos visuales reportados', () => {
  test('el fondo del editor no repite la trama de puntos del lienzo', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/graph-editor');

    const ambient = page.locator('.ambient-bg');
    await expect(ambient).toHaveClass(/ambient-editor/);

    // La trama ambiental debe estar apagada: el lienzo ya pinta la suya.
    const gridDisplay = await page
      .locator('.ambient-grid')
      .evaluate((node) => getComputedStyle(node).display);
    expect(gridDisplay).toBe('none');

    const auroraOpacity = await page
      .locator('.ambient-aurora')
      .evaluate((node) => getComputedStyle(node).opacity);
    expect(Number(auroraOpacity)).toBeCloseTo(0.28, 2);
  });

  test('el tooltip de una fila abre hacia abajo y no pisa la cabecera fija', async ({ page }) => {
    await denseBackend(page);
    await page.goto('/variables');

    const firstAction = page.locator('.table-wrap .action-row .tooltip-wrap').first();
    await expect(firstAction).toBeVisible();
    await firstAction.hover();

    const bubble = firstAction.locator('.tooltip-bubble');
    await expect(bubble).toBeVisible();

    const box = await bubble.boundingBox();
    const trigger = await firstAction.boundingBox();
    const header = await page.locator('.table-wrap thead').first().boundingBox();
    expect(box && trigger && header).toBeTruthy();

    // Abre por DEBAJO de su disparador…
    expect(box!.y).toBeGreaterThan(trigger!.y);
    // …y por tanto no invade la banda de la cabecera pegajosa.
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  });
});
