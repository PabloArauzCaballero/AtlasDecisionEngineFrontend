import { test, type Page } from '@playwright/test';
import { abrirCuadernoDeTrabajo, mockDataNotebookBackend } from './support/data-notebook-backend';
import { escribirEnCelda, leerCelda } from './support/notebook-editor';

/** Diagnóstico temporal: ejercita los casos que fallaron, en UNA sesión, y cuenta qué pasa. */
test('diag2', async ({ page }: { page: Page }) => {
  test.setTimeout(900_000);
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));

  await mockDataNotebookBackend(page);
  await abrirCuadernoDeTrabajo(page);
  await page.locator('.notebook-cell__language select').first().selectOption('r');

  async function correr(indice: number, codigo: string, etiqueta: string) {
    await escribirEnCelda(page, indice, codigo);
    console.log(`\n=== ${etiqueta} ===`);
    console.log('escrito:', JSON.stringify(await leerCelda(page, indice)));
    const celda = page.locator('.notebook-cell').nth(indice);
    await celda.locator('.notebook-cell__run').click();
    await celda
      .locator('.notebook-cell__output')
      .waitFor({ state: 'visible', timeout: 300_000 })
      .catch(() => console.log('SIN SALIDA'));
    console.log(
      'salida:',
      JSON.stringify(
        (await celda.locator('.notebook-cell__output').allInnerTexts()).join(' | ').slice(0, 400),
      ),
    );
    console.log('tablas:', await celda.locator('.notebook-table').count());
    console.log('figuras:', await celda.locator('.notebook-cell__figura img').count());
  }

  await correr(0, 'umbral <- 2', 'asignacion invisible');

  await page.getByRole('button', { name: 'Celda de R', exact: true }).click();
  await page.locator('.notebook-cell').nth(1).locator('select').selectOption('r');
  await correr(1, 'umbral * 21', 'usa la variable anterior');

  await page.getByRole('button', { name: 'Celda de R', exact: true }).click();
  await page.locator('.notebook-cell').nth(2).locator('select').selectOption('r');
  await correr(2, 'barplot(table(df$status))', 'grafico');

  await page.getByRole('button', { name: 'Celda de R', exact: true }).click();
  await page.locator('.notebook-cell').nth(3).locator('select').selectOption('r');
  await correr(3, 'print(n); no_existe_esto', 'print y error');
  console.log(
    'logs:',
    await page.locator('.notebook-cell').nth(3).locator('.notebook-cell__logs').allInnerTexts(),
  );
  console.log(
    'error:',
    await page.locator('.notebook-cell').nth(3).locator('.notebook-cell__error').allInnerTexts(),
  );
});
