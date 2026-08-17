import { expect, test, type Page } from '@playwright/test';
import { abrirCuadernoDeTrabajo, mockDataNotebookBackend } from './support/data-notebook-backend';
import { escribirEnCelda } from './support/notebook-editor';

/**
 * El intérprete de Python del cuaderno, ejecutándose de verdad.
 *
 * Va en su propia especificación porque carga 21 MB de CPython compilado a WebAssembly y tarda
 * decenas de segundos: metido en la batería general la volvería lenta y la ataría a un artefacto
 * que no se versiona (`public/pyodide/`, lo trae `node scripts/setup-pyodide.mjs`).
 *
 * Lo que prueba, y que ninguna prueba de la interfaz puede sustituir: que la CSP del portal deja
 * compilar WebAssembly. `'wasm-unsafe-eval'` es un token nuevo en `script-src`, y si estuviera mal
 * puesto el fallo sería un mensaje en la consola del navegador —donde nadie mira— y una pestaña de
 * Python que no arranca nunca. Córrela contra la BUILD (`next start`), no sólo contra el servidor
 * de desarrollo: en desarrollo la CSP añade `'unsafe-eval'` y taparía el fallo.
 */

/** Arrancar el intérprete y cargar pandas puede tardar; el plazo es del artefacto, no del código. */
const PLAZO_INTERPRETE = 240_000;

test.describe('cuaderno de datos · Python', () => {
  test.slow();

  async function abrir(page: Page) {
    await mockDataNotebookBackend(page);
    await abrirCuadernoDeTrabajo(page);
  }

  /**
   * Falla con el motivo que la pantalla enseña, en vez de con un tiempo agotado sin explicación.
   *
   * El `.first()` del final NO es cosmético. Cuando el intérprete no está, la pantalla enseña las
   * DOS cosas —el aviso de que falta y el error dentro de la celda—, y un `or()` que resuelve a
   * dos elementos revienta por modo estricto de Playwright con «strict mode violation», que es un
   * mensaje sobre el localizador y no sobre el defecto. Justo en el caso que esta guarda existe
   * para explicar bien.
   */
  async function esperarSalida(page: Page) {
    const salida = page.locator('.notebook-cell__output').first();
    const caido = page.locator('.notebook-runtime--unavailable');

    await expect(salida.or(caido).first()).toBeVisible({ timeout: PLAZO_INTERPRETE });
    if (await caido.isVisible()) {
      throw new Error(`El intérprete no arrancó: ${await caido.innerText()}`);
    }
    return salida;
  }

  test('ejecuta pandas sobre el dataset cargado y devuelve una tabla', async ({ page }) => {
    await abrir(page);

    await escribirEnCelda(page, 0, 'df.groupby("status").size().reset_index(name="cuantos")');
    await page.locator('.notebook-cell__run').first().click();

    const salida = await esperarSalida(page);
    // Dos estados en el simulado (ACTIVE y SUSPENDED): la agrupación tiene que dar dos filas.
    await expect(salida.locator('.notebook-table tbody tr')).toHaveCount(2);
    await expect(salida).toContainText('SUSPENDED');
    await expect(page.locator('.notebook-runtime--ready')).toBeVisible();

    // La captura va DESPUÉS de las aserciones, no en su lugar: así la foto sólo existe si lo que
    // muestra es cierto. Es la única evidencia donde se ve pandas resolviendo de verdad.
    //
    // De la ventana y no de la página completa: la barra lateral es `position: fixed` y en una
    // captura de página entera el navegador la dibuja a la altura del scroll, flotando sobre la
    // tabla. La imagen se leería como una interfaz rota cuando lo roto seria la forma de mirarla.
    await page.locator('.notebook-cell').first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'docs/visual-evidence/cuaderno/04-celda-python-pandas.png',
      animations: 'disabled',
    });
  });

  /**
   * matplotlib dibujando de verdad, y el PNG saliendo del navegador.
   *
   * Es la prueba que no puede sustituirse mirando el código: entre `plt.plot(...)` y una imagen en
   * pantalla hay tres cosas que sólo fallan en ejecución —que la rueda de matplotlib esté en el
   * artefacto, que el backend sea `AGG` (con el de serie, `savefig` no produce nada) y que la
   * figura se recoja y se cierre—. Cualquiera de las tres se rompe en silencio: la celda diría que
   * corrió sin devolver nada.
   */
  test('un gráfico de pyplot se pinta y se puede descargar', async ({ page }) => {
    await abrir(page);

    await escribirEnCelda(
      page,
      0,
      'import matplotlib.pyplot as plt\n' +
        'conteo = df.groupby("status").size()\n' +
        'plt.figure()\n' +
        'plt.bar(conteo.index, conteo.values)\n' +
        'plt.title("Clientes por estado")\n',
    );
    await page.locator('.notebook-cell__run').first().click();

    await esperarSalida(page);
    const figura = page.locator('.notebook-cell__figura img').first();
    await expect(figura).toBeVisible({ timeout: PLAZO_INTERPRETE });
    // Que sea un PNG de verdad y no un hueco: la imagen tiene que haber decodificado con ancho.
    await expect(figura).toHaveAttribute('src', /^data:image\/png;base64,/);
    expect(await figura.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);

    // Y que el botón descargue: se comprueba el archivo que el navegador recibe, no que exista el
    // botón. Un `onClick` sin cablear se ve idéntico a uno cableado.
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar PNG' }).first().click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/\.png$/);

    await page.locator('.notebook-cell').first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'docs/visual-evidence/cuaderno/10-grafico-pyplot.png',
      animations: 'disabled',
    });
  });

  test('print viaja como salida y el traceback de Python se enseña entero', async ({ page }) => {
    await abrir(page);

    await escribirEnCelda(page, 0, 'print("filas:", len(rows))\nraise ValueError("a propósito")');
    await page.locator('.notebook-cell__run').first().click();

    await esperarSalida(page);
    await expect(page.locator('.notebook-cell__logs')).toContainText('filas: 100');
    // El traceback completo, no la última línea: sin él no se sabe en qué línea falló.
    await expect(page.locator('.notebook-cell__error')).toContainText('ValueError');
    await expect(page.locator('.notebook-cell__error')).toContainText('a propósito');
  });
});
