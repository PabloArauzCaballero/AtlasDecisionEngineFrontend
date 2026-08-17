import { expect, test, type Page } from '@playwright/test';
import { abrirCuadernoDeTrabajo, mockDataNotebookBackend } from './support/data-notebook-backend';
import { escribirEnCelda } from './support/notebook-editor';

/**
 * El intérprete de R del cuaderno, ejecutándose de verdad.
 *
 * Va en su propia especificación por lo mismo que la de Python: carga decenas de MB de R compilado
 * a WebAssembly y tarda; metida en la batería general la volvería lenta y la ataría a un artefacto
 * que no se versiona (`public/webr/`, lo publica `node scripts/setup-webr.mjs`).
 *
 * Lo que prueba, y que ninguna prueba de la interfaz puede sustituir:
 *
 *  1. **Que la CSP del artefacto deja arrancar el worker.** Un worker NO hereda la política de la
 *     página que lo crea, así que `/webr/` lleva la suya (`middleware.next.ts`). Si estuviera mal,
 *     el fallo sería un mensaje en la consola del navegador —donde nadie mira— y una celda de R que
 *     no arranca nunca.
 *  2. **Que el preámbulo de R es R válido.** Es texto dentro de TypeScript: un paréntesis de más no
 *     lo detecta ni el compilador ni el `lint`, sólo el intérprete.
 *  3. **Que el reparto de tipos por columna llega entero.** `mean(df$importe)` sobre una columna que
 *     viajó como texto devuelve `NA` sin fallar, que es la peor forma de estar mal.
 *
 * Córrela contra la BUILD (`PW_BASE_URL=http://localhost:5188`, tras `next start`), no sólo contra
 * el servidor de desarrollo: en desarrollo la CSP del documento añade `'unsafe-eval'`.
 */

/** Arrancar R puede tardar: el plazo es del artefacto, no del código. */
const PLAZO_INTERPRETE = 240_000;

test.describe('cuaderno de datos · R', () => {
  test.slow();

  async function abrirCeldaDeR(page: Page) {
    await mockDataNotebookBackend(page);
    await abrirCuadernoDeTrabajo(page);
    // La celda de serie es de Python: se cambia el lenguaje en el desplegable, que es también el
    // camino que hace cualquiera y el que rompería si `setLanguage` no conociera R.
    await page.locator('.notebook-cell__language select').first().selectOption('r');
  }

  /**
   * Falla con el motivo que la pantalla enseña, en vez de con un tiempo agotado sin explicación.
   * El `.first()` evita la «strict mode violation» cuando se ven a la vez el aviso y el error de la
   * celda, que es justo el caso que esta guarda existe para explicar bien.
   */
  async function esperarSalida(page: Page) {
    const salida = page.locator('.notebook-cell__output').first();
    const caido = page.locator('.notebook-runtime--unavailable');

    await expect(salida.or(caido).first()).toBeVisible({ timeout: PLAZO_INTERPRETE });
    if (await caido.isVisible()) {
      throw new Error(`El intérprete de R no arrancó: ${await caido.innerText()}`);
    }
    return salida;
  }

  test('agrupa el dataset cargado y devuelve una tabla', async ({ page }) => {
    await abrirCeldaDeR(page);

    await escribirEnCelda(page, 0, 'table(df$status)');
    await page.locator('.notebook-cell__run').first().click();

    const salida = await esperarSalida(page);
    // Dos estados en el simulado (ACTIVE y SUSPENDED): la tabla tiene que dar dos filas.
    await expect(salida.locator('.notebook-table tbody tr')).toHaveCount(2);
    await expect(salida).toContainText('SUSPENDED');
    await expect(page.locator('.notebook-runtime--ready')).toBeVisible();

    // La captura va DESPUÉS de las aserciones: así la foto sólo existe si lo que muestra es cierto.
    await page.locator('.notebook-cell').first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'docs/visual-evidence/cuaderno/11-celda-r.png',
      animations: 'disabled',
    });
  });

  /**
   * El entorno de R PERSISTE entre celdas, igual que el de Python y al revés que el de JavaScript.
   * Es la mitad de lo que significa «cuaderno», y lo único que lo demuestra es correr dos celdas.
   */
  test('lo definido en una celda sigue vivo en la siguiente', async ({ page }) => {
    await abrirCeldaDeR(page);

    await escribirEnCelda(page, 0, 'umbral <- 2');
    await page.locator('.notebook-cell__run').first().click();
    await esperarSalida(page);

    await page.getByRole('button', { name: 'Celda de R', exact: true }).click();
    const segunda = page.locator('.notebook-cell').nth(1);
    await escribirEnCelda(page, 1, 'umbral * 21');
    await segunda.locator('.notebook-cell__run').click();

    await expect(segunda.locator('.notebook-cell__output')).toContainText('42', {
      timeout: PLAZO_INTERPRETE,
    });
  });

  /**
   * Una asignación NO imprime, y una expresión SÍ.
   *
   * Es la regla de cualquier consola de R (`withVisible`), y sin ella una celda que sólo guarda un
   * subconjunto volvería a pintar la tabla entera debajo — que se lee como un resultado y no lo es.
   */
  test('una asignación no produce salida y la expresión siguiente sí', async ({ page }) => {
    await abrirCeldaDeR(page);

    await escribirEnCelda(page, 0, 'activos <- subset(df, status == "ACTIVE")');
    await page.locator('.notebook-cell__run').first().click();
    // Hay salida (la celda corrió), pero sin tabla: lo asignado es invisible.
    const salida = await esperarSalida(page);
    await expect(salida.locator('.notebook-table')).toHaveCount(0);

    await page.getByRole('button', { name: 'Celda de R', exact: true }).click();
    const segunda = page.locator('.notebook-cell').nth(1);
    await escribirEnCelda(page, 1, 'nrow(activos)');
    await segunda.locator('.notebook-cell__run').click();
    await expect(segunda.locator('.notebook-cell__output')).toBeVisible({
      timeout: PLAZO_INTERPRETE,
    });
  });

  /**
   * Un gráfico de R saliendo del navegador como PNG.
   *
   * Entre `barplot(...)` y una imagen en pantalla hay tres cosas que sólo fallan en ejecución: que
   * el dispositivo de lienzo de WebR esté activo, que el `ImageBitmap` se vuelque a un `canvas`, y
   * que el `data:` resultante decodifique. Las tres se rompen en silencio.
   */
  test('un gráfico se pinta y se puede descargar', async ({ page }) => {
    await abrirCeldaDeR(page);

    await escribirEnCelda(page, 0, 'barplot(table(df$status))');
    await page.locator('.notebook-cell__run').first().click();

    await esperarSalida(page);
    const figura = page.locator('.notebook-cell__figura img').first();
    await expect(figura).toBeVisible({ timeout: PLAZO_INTERPRETE });
    await expect(figura).toHaveAttribute('src', /^data:image\/png;base64,/);
    expect(await figura.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar PNG' }).first().click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/\.png$/);
  });

  test('print viaja como salida y el error de R se enseña sin el envoltorio del cuaderno', async ({
    page,
  }) => {
    await abrirCeldaDeR(page);

    await escribirEnCelda(page, 0, 'print(n)\nno_existe_esto');
    await page.locator('.notebook-cell__run').first().click();

    await esperarSalida(page);
    await expect(page.locator('.notebook-cell__logs')).toContainText('100');
    await expect(page.locator('.notebook-cell__error')).toContainText('no_existe_esto');
    // El envoltorio (`eval(expresion, envir = globalenv())`) manda a buscar el fallo en una función
    // que quien escribió la celda no escribió.
    await expect(page.locator('.notebook-cell__error')).not.toContainText('envir = globalenv()');
  });
});
