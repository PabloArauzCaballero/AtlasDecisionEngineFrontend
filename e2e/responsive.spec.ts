import { expect, test } from '@playwright/test';
import { mockBackend } from './support/backend-mock';
import { denseBackend } from './support/dense-backend';

/**
 * Ninguna vista debe desbordar horizontalmente.
 *
 * El desbordamiento lateral es el defecto responsive que más molesta y el más
 * fácil de introducir sin darse cuenta: una tabla ancha, un panel con un mínimo
 * en píxeles o un chip que no envuelve empujan la página entera, y a partir de
 * ahí TODO se lee desplazándose. Se mide el ancho real del documento contra el
 * del viewport, que es la definición operativa del problema.
 */
const VIEWPORTS = [
  { name: 'móvil', width: 360, height: 800 },
  { name: 'tableta', width: 768, height: 1024 },
  { name: 'portátil', width: 1366, height: 768 },
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'panorámico', width: 1920, height: 1080 },
] as const;

const ROUTES = ['/variables', '/calculated-fields', '/action-catalog', '/graph-editor'] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} · ${viewport.width}×${viewport.height}`, () => {
    for (const route of ROUTES) {
      test(`${route} no desborda en horizontal`, async ({ page }) => {
        // El listado denso llena las tablas: una vista vacía nunca desborda y no
        // demostraría nada.
        await (route === '/graph-editor' ? mockBackend(page) : denseBackend(page));
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route);
        await page.waitForTimeout(700);

        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));

        // Un píxel de margen absorbe el redondeo de los navegadores al escalar.
        expect(
          overflow.scroll,
          `${route} desborda ${overflow.scroll - overflow.client}px`,
        ).toBeLessThanOrEqual(overflow.client + 1);
      });
    }
  });
}
