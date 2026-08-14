import { expect, test, type Page } from '@playwright/test';
import { collectProblems } from './support/backend-mock';
import { mockDataNotebookBackend } from './support/data-notebook-backend';

/**
 * El cuaderno de datos, con TODOS sus controles pulsados.
 *
 * No es una prueba de humo. Un cuaderno tiene una veintena de botones —ejecutar, añadir, subir,
 * bajar, duplicar, borrar, paginar, descargar— y el fallo típico de una pantalla así no es que no
 * cargue: es que uno de esos botones no haga nada. Un `onClick` sin cablear se ve exactamente
 * igual que uno cableado, así que aquí cada control se pulsa y se comprueba su EFECTO.
 *
 * Python queda fuera a propósito y está en su propia prueba: descargar 21 MB de intérprete dentro
 * de la batería general la volvería lenta y dependiente de un artefacto que no se versiona.
 */

const RUTA = '/workers/data-notebook';

async function abrirCuaderno(page: Page) {
  await mockDataNotebookBackend(page);
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.notebook')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.notebook-cell')).toHaveCount(1);
}

/** Reemplaza el contenido de una celda: el `textarea` conserva la plantilla de serie. */
async function escribir(page: Page, indice: number, codigo: string) {
  const area = page.locator('.notebook-cell__code').nth(indice);
  await area.click();
  await page.keyboard.press('ControlOrMeta+a');
  await area.fill(codigo);
}

test.describe('cuaderno de datos', () => {
  test('carga el dataset y rotula las columnas por su política', async ({ page }) => {
    const problemas = collectProblems(page);
    await abrirCuaderno(page);

    await expect(page.locator('.notebook-dataset__description')).toContainText(
      'Una fila por cliente',
    );
    // La cabecera dice la política EN LA COLUMNA. Un aviso general obligaría a adivinar cuál.
    const cabeceras = page.locator('.notebook-table thead th');
    await expect(cabeceras.filter({ hasText: 'contact_email' })).toContainText('enmascarado');
    await expect(cabeceras.filter({ hasText: 'session_token_hash' })).toContainText('no se sirve');
    await expect(page.locator('.notebook-dataset__notice')).toBeVisible();

    expect(problemas).toEqual([]);
  });

  test('la paginación del servidor trae filas distintas en cada página', async ({ page }) => {
    await abrirCuaderno(page);

    const primeraCelda = page.locator('.notebook-dataset .notebook-table tbody tr').first();
    await expect(primeraCelda).toContainText('cliente-1');

    await page
      .locator('.notebook-dataset .notebook-result__pager button', { hasText: 'Siguiente' })
      .click();
    await expect(page.locator('.notebook-dataset .notebook-result__page')).toContainText(
      'Página 2 de 3',
    );
    await expect(primeraCelda).toContainText('cliente-101');

    await page
      .locator('.notebook-dataset .notebook-result__pager button', { hasText: 'Anterior' })
      .click();
    await expect(page.locator('.notebook-dataset .notebook-result__page')).toContainText(
      'Página 1 de 3',
    );
  });

  test('una celda de JavaScript se ejecuta y su resultado sale como tabla', async ({ page }) => {
    await abrirCuaderno(page);

    await page.locator('.notebook-cell__language select').selectOption('javascript');
    await escribir(
      page,
      0,
      'return rows.filter((fila) => fila.status === "SUSPENDED").slice(0, 4);',
    );
    await page.locator('.notebook-cell__run').click();

    const salida = page.locator('.notebook-cell__output');
    await expect(salida).toBeVisible({ timeout: 30_000 });
    await expect(salida.locator('.notebook-table tbody tr')).toHaveCount(4);
    // El número de ejecución deja de estar vacío: es lo que distingue «corrió» de «no se pulsó».
    await expect(page.locator('.notebook-cell__count')).toContainText('[1]');
  });

  test('console.log de una celda se recoge como salida, no se pierde', async ({ page }) => {
    await abrirCuaderno(page);

    await page.locator('.notebook-cell__language select').selectOption('javascript');
    await escribir(page, 0, 'console.log("filas:", rows.length); return null;');
    await page.locator('.notebook-cell__run').click();

    await expect(page.locator('.notebook-cell__logs')).toContainText('filas: 100', {
      timeout: 30_000,
    });
  });

  test('un error de la celda se enseña con su mensaje y no rompe la página', async ({ page }) => {
    await abrirCuaderno(page);

    await page.locator('.notebook-cell__language select').selectOption('javascript');
    await escribir(page, 0, 'throw new Error("algo salió mal");');
    await page.locator('.notebook-cell__run').click();

    const error = page.locator('.notebook-cell__error');
    await expect(error).toContainText('algo salió mal', { timeout: 30_000 });
    // La página sigue viva: se puede corregir y volver a ejecutar sin recargar.
    await escribir(page, 0, 'return [{ ok: true }];');
    await page.locator('.notebook-cell__run').click();
    await expect(page.locator('.notebook-cell__output .notebook-table')).toBeVisible({
      timeout: 30_000,
    });
  });

  test('añadir, duplicar, mover y borrar celdas', async ({ page }) => {
    await abrirCuaderno(page);

    await page.getByRole('button', { name: /Celda de JavaScript/ }).click();
    await expect(page.locator('.notebook-cell')).toHaveCount(2);

    await page.getByRole('button', { name: 'Duplicar celda 1' }).click();
    await expect(page.locator('.notebook-cell')).toHaveCount(3);

    // Se marca la primera celda para poder afirmar que el movimiento la desplazó de verdad.
    await escribir(page, 0, '# primera');
    await page.getByRole('button', { name: 'Bajar celda 1' }).click();
    await expect(page.locator('.notebook-cell__code').nth(1)).toHaveValue('# primera');

    await page.getByRole('button', { name: 'Eliminar celda 3' }).click();
    await expect(page.locator('.notebook-cell')).toHaveCount(2);
  });

  test('la última celda no se puede borrar: un cuaderno sin celdas no tiene vuelta', async ({
    page,
  }) => {
    await abrirCuaderno(page);
    await expect(page.getByRole('button', { name: 'Eliminar celda 1' })).toBeDisabled();
  });

  test('cambiar de dataset descarta los resultados que ya no corresponden', async ({ page }) => {
    await abrirCuaderno(page);

    await page.locator('.notebook-cell__language select').selectOption('javascript');
    await escribir(page, 0, 'return [{ ok: true }];');
    await page.locator('.notebook-cell__run').click();
    await expect(page.locator('.notebook-cell__output')).toBeVisible({ timeout: 30_000 });

    await page.locator('.notebook-dataset__picker select').selectOption('audit-event-feed');
    // Dejar el resultado anterior junto a datos nuevos es la forma más silenciosa de concluir mal.
    await expect(page.locator('.notebook-cell__output')).toHaveCount(0);
  });

  test('las descargas producen un archivo CSV y otro JSON', async ({ page }) => {
    await abrirCuaderno(page);

    const barra = page.locator('.notebook-dataset .notebook-result__actions');

    const csv = page.waitForEvent('download');
    await barra.getByRole('button', { name: 'CSV' }).click();
    expect((await csv).suggestedFilename()).toMatch(/^panorama-de-clientes-.*\.csv$/);

    const json = page.waitForEvent('download');
    await barra.getByRole('button', { name: 'JSON' }).click();
    expect((await json).suggestedFilename()).toMatch(/^panorama-de-clientes-.*\.json$/);
  });

  test('el atajo Ctrl+Enter ejecuta la celda', async ({ page }) => {
    await abrirCuaderno(page);

    await page.locator('.notebook-cell__language select').selectOption('javascript');
    await escribir(page, 0, 'return [{ atajo: true }];');
    await page.locator('.notebook-cell__code').first().press('ControlOrMeta+Enter');

    await expect(page.locator('.notebook-cell__output .notebook-table')).toBeVisible({
      timeout: 30_000,
    });
  });
});
