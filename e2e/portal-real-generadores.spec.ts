import { expect, test } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';
import { deAplicacion, vigilar } from './support/real-portal-watch';
import { esperarVista } from './support/real-portal-sweep';

/**
 * Los GENERADORES DE DATOS DE PRUEBA del portal.
 *
 * QA Lab genera casos a partir del contrato y el simulador consume entradas de
 * ejemplo. Lo que se comprueba de ambos no es que produzcan algo, sino que lo
 * que producen sea UTILIZABLE: un generador que llena la tabla de «undefined»,
 * «NaN» o «[object Object]» pasa cualquier prueba de humo y no sirve para
 * probar nada.
 */

test.describe.configure({ mode: 'serial' });

test.describe('generadores de datos de prueba · motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  /* ------------------------------------------------------------------ *
   * 6 · El generador de datos de prueba (QA Lab) produce valores utilizables
   * ------------------------------------------------------------------ */

  test('el QA Lab genera casos con valores que respetan el contrato', async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const problemas = vigilar(page, () => '/qa-lab');
    await entrar(page);

    await page.goto('/qa-lab', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });

    // La vista tiene que ofrecer de verdad un generador; si no, lo que sigue
    // mediría una pantalla vacía y pasaría en verde sin probar nada.
    const generar = page.getByRole('button', { name: /generar|ejecutar|crear casos/i }).first();
    /*
     * AFIRMACIÓN, no salto. Antes esto era `test.skip(count() === 0)`, y con eso una regresión
     * que borrara el control dejaba la prueba EN VERDE: el único caso que la prueba existe
     * para detectar era también el único que la hacía saltar. Un salto por CONFIGURACIÓN es
     * legítimo —sin credenciales no hay nada que medir—; uno por interfaz ausente no.
     */
    await expect(generar).toBeVisible({ timeout: 30_000 });

    if (await generar.isEnabled()) {
      await generar.click();
      await page.waitForTimeout(3_000);
      await esperarVista(page);

      // Lo generado tiene que ser LEGIBLE. Un generador que produce «null»,
      // «undefined» o «[object Object]» llena la tabla y no sirve para probar
      // nada: es el fallo que esta comprobación existe para atrapar.
      const cuerpo = await page.locator('main, .page').first().innerText();
      expect(cuerpo).not.toMatch(/\[object Object\]/);
      expect(cuerpo).not.toMatch(/\bundefined\b/);
      expect(cuerpo).not.toMatch(/\bNaN\b/);
    }

    expect(deAplicacion(problemas)).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * 7 · El simulador: entrada inválida y muestras precargadas
   * ------------------------------------------------------------------ */

  test('el simulador rechaza una entrada inválida y explica el porqué', async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const problemas = vigilar(page, () => '/simulator');
    await entrar(page);

    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });

    const editor = page.locator('textarea').first();
    if ((await editor.count()) > 0) {
      // JSON roto: el portal debe decirlo en la propia vista, no dejar que el
      // motor devuelva un 400 opaco.
      await editor.fill('{ esto no es json ');
      const ejecutar = page.getByRole('button', { name: /simular|ejecutar|probar/i }).first();
      if ((await ejecutar.count()) > 0 && (await ejecutar.isEnabled())) {
        await ejecutar.click();
        await page.waitForTimeout(2_000);
        const cuerpo = await page.locator('main, .page').first().innerText();
        expect(cuerpo, 'el simulador debe explicar el JSON inválido').toMatch(
          /json|inválid|formato|error/i,
        );
      }
    }

    expect(deAplicacion(problemas)).toEqual([]);
  });
});
