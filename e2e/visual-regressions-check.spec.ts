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

    // La aurora ya no se atenúa: se retira. Atenuarla (0.5 -> 0.28) dejaba el
    // tinte más tenue pero seguía teñendo de verde los paneles blancos del
    // editor, y se reportó tres veces. `editor-background.spec.ts` fija la
    // decisión completa para las tres capas de color.
    const auroraDisplay = await page
      .locator('.ambient-aurora')
      .evaluate((node) => getComputedStyle(node).display);
    expect(auroraDisplay).toBe('none');
  });

  test('el tooltip de una fila se pinta entero dentro de la ventana', async ({ page }) => {
    await denseBackend(page);
    await page.goto('/variables');

    const firstAction = page.locator('.table-wrap .action-row .tooltip-wrap').first();
    await expect(firstAction).toBeVisible();
    await firstAction.hover();

    // El globo ya no vive dentro de la fila: se monta en `document.body`
    // (`useHintBubble`), porque como absoluto dentro de la tabla quedaba preso
    // de su contexto de apilamiento —la cabecera pegajosa lo tapaba— y del
    // `overflow` del contenedor, que lo recortaba. Antes se esquivaba abriendo
    // hacia abajo; ahora el globo pinta por encima de cualquier banda pegajosa
    // y lo que se fija es que aparece entero, sin recorte por ningún borde.
    const bubble = page.locator('.tooltip-bubble[data-open="true"]');
    await expect(bubble).toBeVisible();

    const box = await bubble.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();

    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  });
});
