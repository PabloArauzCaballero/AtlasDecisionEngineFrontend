import { expect, test, type Page } from '@playwright/test';
import { abrirCuadernoDeTrabajo, mockDataNotebookBackend } from './support/data-notebook-backend';
import { abrirHistorial, escribirEnCelda, esperarContenido } from './support/notebook-editor';

/**
 * Los controles que la primera especificación NO llegó a pulsar, y la evidencia visual.
 *
 * Existe porque una auditoría de la propia batería encontró siete botones sin cubrir —«Subir»,
 * «Recargar», «Celda de Python», y las descargas y el paginador de la salida de una celda—
 * mientras el informe decía «todos los botones funcionan». Un control sin pulsar es exactamente
 * igual de invisible que uno roto, así que la lista de lo probado tiene que salir de la lista de
 * lo que existe y no de la memoria de quien escribió la prueba.
 *
 * Va aparte de `data-notebook.spec.ts` por el techo de 299 líneas del repositorio, no porque sea
 * de otra clase.
 *
 * Las capturas se toman en la misma prueba que afirma, como en `locucion.spec.ts`: una captura sin
 * aserción no detecta nada, y una aserción sin captura no deja ver si el resultado se lee.
 */

const OUT = 'docs/visual-evidence/cuaderno';

async function abrirCuaderno(page: Page) {
  await mockDataNotebookBackend(page);
  await abrirCuadernoDeTrabajo(page);
  // Señal POSITIVA, nunca la desaparición de un indicador de carga: «no está» y «todavía no está»
  // son indistinguibles, y así se llenó una vez un directorio con 440 fotos de un spinner.
  await expect(page.locator('.notebook-dataset .notebook-table tbody tr').first()).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Captura la VENTANA, no la página entera, tras traer a la vista lo que se quiere enseñar.
 *
 * `fullPage: true` parecía la opción generosa y produce evidencia inservible en este portal: la
 * barra lateral es `position: fixed`, y en una captura de página completa el navegador la dibuja
 * a la altura del scroll —o sea, flotando en mitad de una tabla de cien filas—. La imagen se lee
 * como una interfaz rota cuando lo único roto es la forma de fotografiarla.
 */
async function capturar(page: Page, nombre: string, anclaje: string) {
  await page.locator(anclaje).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${nombre}`, animations: 'disabled' });
}

async function ejecutarJs(page: Page, codigo: string) {
  await page
    .locator('.notebook-cell__language')
    .first()
    .locator('select')
    .selectOption('javascript');
  // Escribir pasa por `support/notebook-editor.ts`: el editor es Monaco y el
  // `.notebook-cell__code` de antes sólo existe hasta que monta.
  await escribirEnCelda(page, 0, codigo);
  await page.locator('.notebook-cell__run').first().click();
  await expect(page.locator('.notebook-cell__output').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('cuaderno de datos · controles restantes', () => {
  test('«Recargar» vuelve a pedir la página al servidor', async ({ page }) => {
    await abrirCuaderno(page);

    let peticiones = 0;
    page.on('request', (peticion) => {
      if (peticion.url().includes('/data-notebook/datasets/') && peticion.url().includes('/rows'))
        peticiones += 1;
    });

    await page.getByRole('button', { name: 'Recargar' }).click();
    // El botón existe para volver a preguntar: si no dispara una petición, es un adorno.
    await expect.poll(() => peticiones, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.locator('.notebook-dataset .notebook-table tbody tr').first()).toBeVisible();
  });

  test('«Celda de Python» añade una celda, y llega en Python', async ({ page }) => {
    await abrirCuaderno(page);
    await expect(page.locator('.notebook-cell')).toHaveCount(1);

    await page.getByRole('button', { name: /Celda de Python/ }).click();
    await expect(page.locator('.notebook-cell')).toHaveCount(2);
    // El lenguaje del botón que se pulsó, no el de la celda anterior.
    await expect(page.locator('.notebook-cell__language select').nth(1)).toHaveValue('python');
  });

  test('«Subir» mueve la celda hacia arriba', async ({ page }) => {
    await abrirCuaderno(page);

    await page.getByRole('button', { name: /Celda de JavaScript/ }).click();
    await escribirEnCelda(page, 1, '# segunda');

    await page.getByRole('button', { name: 'Subir celda 2' }).click();
    await esperarContenido(page, 0, '# segunda');
    // La primera celda no puede subir más: el botón se apaga en vez de no hacer nada.
    await expect(page.getByRole('button', { name: 'Subir celda 1' })).toBeDisabled();
  });

  test('la salida de una celda pagina en el cliente y respeta «Filas por página»', async ({
    page,
  }) => {
    await abrirCuaderno(page);
    await ejecutarJs(page, 'return rows;');

    const salida = page.locator('.notebook-cell__output');
    // 100 filas con el tamaño de serie (50) son dos páginas, y la segunda existe de verdad.
    await expect(salida.locator('.notebook-result__page')).toContainText('Página 1 de 2');
    await expect(salida.locator('.notebook-table tbody tr')).toHaveCount(50);

    await salida.getByRole('button', { name: 'Siguiente' }).click();
    await expect(salida.locator('.notebook-result__page')).toContainText('Página 2 de 2');
    await expect(salida.locator('.notebook-table tbody tr').first()).toContainText('cliente-51');

    await salida.getByRole('button', { name: 'Anterior' }).click();
    await expect(salida.locator('.notebook-result__page')).toContainText('Página 1 de 2');

    await salida.getByLabel('Filas por página').selectOption('25');
    await expect(salida.locator('.notebook-result__page')).toContainText('Página 1 de 4');
    await expect(salida.locator('.notebook-table tbody tr')).toHaveCount(25);
  });

  test('la descarga de una celda se lleva TODAS las filas, no sólo la página visible', async ({
    page,
  }) => {
    await abrirCuaderno(page);
    await ejecutarJs(page, 'return rows;');

    const salida = page.locator('.notebook-cell__output');
    await expect(salida.locator('.notebook-table tbody tr')).toHaveCount(50);

    const descarga = page.waitForEvent('download');
    await salida.getByRole('button', { name: 'CSV' }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/^celda-1-.*\.csv$/);

    const ruta = await archivo.path();
    const texto = ruta ? await (await import('node:fs/promises')).readFile(ruta, 'utf8') : '';
    // 100 filas + cabecera. Es el desliz clásico de este componente: descargar lo que se ve.
    expect(texto.trim().split(/\r?\n/)).toHaveLength(101);
    expect(texto).toContain('cliente-100');

    const json = page.waitForEvent('download');
    await salida.getByRole('button', { name: 'JSON' }).click();
    expect((await json).suggestedFilename()).toMatch(/^celda-1-.*\.json$/);
  });

  test('evidencia: la vista con el dataset cargado y una celda resuelta', async ({ page }) => {
    await abrirCuaderno(page);

    await expect(page.locator('.notebook-dataset__notice')).toBeVisible();
    await capturar(page, '01-dataset-cargado.png', '.notebook-dataset__head');

    await ejecutarJs(
      page,
      'return rows.filter((f) => f.status === "SUSPENDED").map((f) => ({ cliente: f.customer_id, casos: f.open_case_count }));',
    );
    await expect(page.locator('.notebook-cell__output .notebook-table')).toBeVisible();
    await capturar(page, '02-celda-javascript.png', '.notebook-cell');

    await ejecutarJs(page, 'throw new Error("la columna no existe");');
    await expect(page.locator('.notebook-cell__error')).toContainText('la columna no existe');
    await capturar(page, '03-celda-con-error.png', '.notebook-cell');
  });
});

/**
 * Historial y techo de tamaño: las dos cosas que el cuaderno promete por escrito en pantalla.
 *
 * Se comprueban aquí y no en el backend porque lo que puede fallar es la promesa VISIBLE — que la
 * lista se llene con lo que se ejecutó, que no se llene con resultados, y que un recorte se diga
 * en vez de pasar callado.
 */
test.describe('cuaderno de datos · historial y techo de tamaño', () => {
  test('ejecutar una celda la deja en el historial, con su código y sin resultados', async ({
    page,
  }) => {
    await abrirCuaderno(page);
    // El historial nace PLEGADO: sin desplegarlo, sus aserciones buscan elementos
    // que existen en el componente y no están montados.
    await abrirHistorial(page);
    await expect(page.getByText('Todavía no has ejecutado ninguna celda.')).toBeVisible();

    await ejecutarJs(page, 'return rows.slice(0, 3);');

    const historial = page.locator('.notebook-history__item');
    await expect(historial).toHaveCount(1, { timeout: 15_000 });
    await expect(historial.locator('.notebook-history__source')).toContainText('rows.slice(0, 3)');
    // Lo que se guarda es la medida, no el dato: «3 filas», nunca las tres filas.
    await expect(historial.locator('.notebook-history__meta')).toContainText('3 filas');
    await expect(historial.locator('.notebook-table')).toHaveCount(0);
  });

  test('«Reusar» trae la consulta de vuelta como celda nueva, sin ejecutarla', async ({ page }) => {
    await abrirCuaderno(page);
    await ejecutarJs(page, 'return [{ reusable: true }];');
    await abrirHistorial(page);
    await expect(page.locator('.notebook-history__item')).toHaveCount(1, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Reusar' }).click();

    const celdas = page.locator('.notebook-cell');
    await expect(celdas).toHaveCount(2);
    await esperarContenido(page, 1, 'return [{ reusable: true }];');
    // No se ejecuta sola: los datos de hoy pueden ser otros y quien la reusa tiene que leerla.
    await expect(celdas.nth(1).locator('.notebook-cell__output')).toHaveCount(0);
  });

  test('una celda que falla también deja rastro, con su error', async ({ page }) => {
    await abrirCuaderno(page);

    await page
      .locator('.notebook-cell__language')
      .first()
      .locator('select')
      .selectOption('javascript');
    await escribirEnCelda(page, 0, 'throw new Error("sin permiso");');
    await page.locator('.notebook-cell__run').first().click();
    await expect(page.locator('.notebook-cell__error')).toBeVisible({ timeout: 30_000 });

    await abrirHistorial(page);
    const historial = page.locator('.notebook-history__item').first();
    await expect(historial).toHaveClass(/notebook-history__item--error/, { timeout: 15_000 });
    await expect(historial.locator('.notebook-history__error')).toContainText('sin permiso');
  });
});
