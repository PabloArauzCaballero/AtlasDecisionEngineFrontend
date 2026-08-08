import { expect, test, type Page } from '@playwright/test';
import { mockSimulatorBackend } from './support/simulator-backend';

/**
 * El recorrido paso a paso de una simulación.
 *
 * Aquí se vigilan dos cosas que se rompieron de verdad: que la traza se pueda
 * recorrer en orden —con su posición a la vista— y que sus tablas **desplacen
 * dentro de su caja** en vez de empujar el ancho de la página.
 */

/** Deja la pantalla con una simulación hecha y la traza abierta. */
async function simularConTraza(page: Page) {
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.simulator-form')).toBeVisible({ timeout: 30_000 });

  await page.locator('.simulator-form select').first().selectOption('EXTRACTO_CAPACIDAD_PAGO');
  const ejecutar = page.getByRole('button', { name: /Ejecutar simulación/ });
  await expect(ejecutar).toBeEnabled({ timeout: 20_000 });
  await ejecutar.click();

  const verTraza = page.getByRole('button', { name: /Ver traza de ejecución/ });
  await expect(verTraza).toBeEnabled({ timeout: 30_000 });
  await verTraza.click();
  await expect(page.locator('.node-state-panel')).toBeVisible({ timeout: 20_000 });
}

/**
 * Elementos que se salen de la ventana **sin que nadie los recorte**.
 *
 * No se usa `documentElement.scrollWidth`: `.app-shell` lleva `overflow-x: clip`
 * y esa medida es ciega dentro del marco —lo demuestra
 * `overflow-detector.spec.ts`—.
 *
 * Y no basta con comparar el borde derecho contra el ancho: una tabla DENTRO de
 * una caja que desplaza sobresale en su rectángulo aunque en pantalla esté
 * recortada, y eso es justamente lo que se quiere —desplazar dentro en vez de
 * empujar la página—. Así que se sube por los ancestros: si alguno recorta o
 * desplaza en horizontal, el elemento está contenido y no es un defecto. Lo que
 * se busca es lo que llega hasta la ventana sin que nada lo pare.
 */
async function fueraDeLaVentana(page: Page) {
  return page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    const contenido = (element: Element): boolean => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX !== 'visible') return true;
        parent = parent.parentElement;
      }
      return false;
    };

    const culpables: string[] = [];
    for (const element of document.querySelectorAll('main *')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= ancho + 1) continue;
      if (contenido(element)) continue;
      const clase =
        String(element.className || '')
          .split(' ')
          .filter(Boolean)[0] ?? '';
      culpables.push(
        `${element.tagName.toLowerCase()}${clase ? `.${clase}` : ''} +${Math.round(rect.right - ancho)}px`,
      );
    }
    return culpables;
  });
}

test.describe('traza de una simulación', () => {
  test.setTimeout(120_000);

  test('se recorre paso a paso y dice por dónde va', async ({ page }) => {
    await mockSimulatorBackend(page);
    await simularConTraza(page);

    const posicion = page.locator('.node-state-position');
    await expect(posicion).toContainText('Paso 1 de 5');
    await expect(posicion).toContainText('START');

    // Anterior está deshabilitado en el primero: no hay paso cero.
    await expect(page.getByRole('button', { name: /Anterior/ })).toBeDisabled();

    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(posicion).toContainText('Paso 2 de 5');
    await expect(posicion).toContainText('ANALIZAR_EXTRACTO');

    // Y las fichas siguen sirviendo para saltar directo.
    await page.getByRole('tab', { name: /RECHAZAR/ }).click();
    await expect(posicion).toContainText('Paso 5 de 5');
    await expect(page.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
  });

  test('las tablas de la traza no empujan el ancho de la página', async ({ page }) => {
    await mockSimulatorBackend(page);
    await simularConTraza(page);

    /*
     * El defecto: la tabla del estado de variables —seis columnas y un base64
     * dentro— se llevaba por delante el ancho de la rejilla y desplazaba la
     * PÁGINA entera, arrastrando la barra lateral. La tabla debe desplazarse
     * DENTRO de su caja.
     */
    const culpables = await fueraDeLaVentana(page);
    expect(culpables, `Elementos fuera de la ventana: ${culpables.join(', ')}`).toEqual([]);

    /*
     * Y se puede LLEGAR a la última columna, comprobado llegando.
     *
     * Antes se exigía que la caja desplazara (`scrollWidth > clientWidth`). Eso
     * describía el apaño de entonces —la traza vivía en la columna de resultado,
     * 294 px medidos para una tabla que necesita 622, y arrastrar era la única
     * forma de llegar al final—, no la propiedad que importa. Al darle el ancho
     * completo la tabla cabe entera y la exigencia se volvía en contra: fallaba
     * justo porque el problema estaba resuelto.
     *
     * Esto es más estricto que las dos versiones anteriores, no menos. Se empuja
     * la caja hasta su extremo y se mide dónde queda «Consumida por»: pasa si
     * cabe sin desplazar Y pasa si desplaza hasta ella, pero NO pasa si queda
     * recortada —que es el defecto de verdad y el que ninguna de las dos
     * formulaciones anteriores distinguía—.
     */
    const ultimaColumna = await page
      .locator('.node-state-scroll')
      .first()
      .evaluate((caja) => {
        caja.scrollLeft = caja.scrollWidth;
        const ultima = caja.querySelector('thead th:last-child');
        if (!ultima) return { alcanzada: false, detalle: 'la tabla no tiene cabeceras' };
        const limite = caja.getBoundingClientRect();
        const columna = ultima.getBoundingClientRect();
        return {
          // 1 px de holgura: el redondeo del navegador al escalar.
          alcanzada: columna.right <= limite.right + 1 && columna.left >= limite.left - 1,
          detalle: `columna en ${Math.round(columna.left)}…${Math.round(columna.right)}, caja en ${Math.round(limite.left)}…${Math.round(limite.right)}`,
        };
      });
    expect(
      ultimaColumna.alcanzada,
      `No se llega a la última columna de la traza: ${ultimaColumna.detalle}`,
    ).toBe(true);
  });

  test('tampoco desborda en una pantalla estrecha', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSimulatorBackend(page);
    await simularConTraza(page);

    const culpables = await fueraDeLaVentana(page);
    expect(culpables, `Elementos fuera de la ventana: ${culpables.join(', ')}`).toEqual([]);
  });
});
