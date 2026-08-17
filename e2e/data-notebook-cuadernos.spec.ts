import { expect, test, type Page } from '@playwright/test';
import { mockDataNotebookBackend } from './support/data-notebook-backend';
import { escribirEnCelda, esperarContenido } from './support/notebook-editor';

/**
 * El flujo de DOS pantallas: primero se elige el cuaderno, después se trabaja dentro.
 *
 * Va aparte de `data-notebook.spec.ts` por el tope de 299 líneas, y el corte tiene sentido: aquélla
 * pulsa los controles de una sesión de trabajo; ésta comprueba lo que sobrevive a cerrar la pestaña
 * —el documento, con su avance— y lo que se lee en vez de ejecutarse —la prosa—.
 *
 * Los gráficos NO están aquí: necesitan el intérprete de verdad y viven en
 * `data-notebook-python.spec.ts`, que corre contra la build.
 */

const RUTA = '/data-notebook';
const EVIDENCIA = 'docs/visual-evidence/cuaderno';

async function abrirIndice(page: Page) {
  await mockDataNotebookBackend(page);
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Señal POSITIVA y no la ausencia del indicador de carga: `PortalSessionGuard` lo monta después
  // del primer render, así que «no está» y «todavía no está» serían indistinguibles.
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.notebook-index')).toBeVisible({ timeout: 30_000 });
}

/** Crea un cuaderno desde la portada y espera a estar DENTRO, con la consola montada. */
async function crearCuaderno(page: Page, nombre: string) {
  await page.getByPlaceholder('Nombre del cuaderno nuevo').fill(nombre);
  await page.getByRole('button', { name: 'Nuevo cuaderno' }).click();
  await expect(page).toHaveURL(/\/data-notebook\/\d+$/);
  await expect(page.locator('.notebook')).toBeVisible({ timeout: 30_000 });
}

test.describe('cuadernos de datos · la portada', () => {
  test('se entra ELIGIENDO: primero la lista, no una hoja en blanco', async ({ page }) => {
    await abrirIndice(page);

    await expect(page.getByRole('heading', { name: 'Cuadernos de datos' })).toBeVisible();
    await expect(page.locator('.notebook-index')).toContainText('Todavía no tienes ninguno');
    // La consola NO está en la portada: si apareciera, la lista sería un adorno encima del editor.
    await expect(page.locator('.notebook-cell')).toHaveCount(0);
    // Y esto no es una pestaña de workers.
    await expect(page.locator('.worker-switch')).toHaveCount(0);

    await page.screenshot({ path: `${EVIDENCIA}/06-portada-vacia.png`, fullPage: true });

    await crearCuaderno(page, 'Mora por cosecha');

    await page.goto(RUTA, { waitUntil: 'domcontentloaded' });
    const fila = page.getByRole('row').filter({ hasText: 'Mora por cosecha' });
    await expect(fila).toBeVisible();

    await page.screenshot({ path: `${EVIDENCIA}/07-portada-con-cuadernos.png`, fullPage: true });
  });
});

test.describe('cuadernos de datos · el avance se guarda', () => {
  test('lo que la celda arrojó vuelve al reabrir, y vuelve FECHADO', async ({ page }) => {
    await abrirIndice(page);
    await crearCuaderno(page, 'Clientes activos');

    // JavaScript y no Python: esta prueba mide que el AVANCE se guarda, y arrancar 21 MB de
    // intérprete para eso ataría la batería general a un artefacto que no se versiona.
    await page.locator('.notebook-cell__language select').first().selectOption('javascript');
    await escribirEnCelda(page, 0, 'return rows.length');
    await page.locator('.notebook-cell__run').first().click();
    await expect(page.locator('.notebook-cell__output')).toBeVisible();
    // Recién ejecutado: es de AHORA, así que no lleva rótulo de guardado.
    await expect(page.locator('.notebook-cell__restaurado')).toHaveCount(0);

    await page.getByRole('button', { name: 'Guardar avance' }).click();
    await expect(page.locator('.notebook-savebar button')).toContainText('Guardar avance');

    await page.screenshot({ path: `${EVIDENCIA}/08-avance-guardado.png`, fullPage: true });

    // Volver a la portada y reabrir: es el viaje que hace la gente al día siguiente.
    await page.goto(RUTA, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /Clientes activos/ }).click();
    await expect(page.locator('.notebook')).toBeVisible({ timeout: 30_000 });

    await esperarContenido(page, 0, 'return rows.length');
    // El resultado está, y dice desde cuándo. Sin el rótulo sería indistinguible de uno recién
    // calculado, que es la lectura peligrosa de guardar el avance.
    await expect(page.locator('.notebook-cell__output')).toBeVisible();
    await expect(page.locator('.notebook-cell__restaurado')).toContainText('Resultado guardado el');

    await page.screenshot({ path: `${EVIDENCIA}/09-avance-restaurado.png`, fullPage: true });
  });
});

test.describe('cuadernos de datos · comentarios en Markdown', () => {
  test('renderiza el comentario y NO convierte en enlace un destino ejecutable', async ({
    page,
  }) => {
    await abrirIndice(page);
    await crearCuaderno(page, 'Notas');

    /*
     * `exact` porque la barra de inserción añadió botones «Insertar comentario
     * al principio» y «… en la posición N»: sin él, el nombre accesible casa con
     * tres controles y Playwright se niega —con razón— a adivinar cuál.
     */
    await page.getByRole('button', { name: 'Comentario', exact: true }).click();
    const comentario = page.locator('.notebook-cell').last();
    await expect(comentario.getByText('Comentario', { exact: true })).toBeVisible();

    // Una celda de comentario no se ejecuta: no tiene botón de correr ni número de ejecución.
    await expect(comentario.locator('.notebook-cell__run')).toHaveCount(0);
    await expect(comentario.locator('.notebook-cell__count')).toHaveCount(0);

    await comentario
      .locator('textarea')
      .fill(
        '# Hallazgo\n\nLa mora se concentra en **enero**.\n\n- primera\n- segunda\n\nVer [la consola](/sql-console) y [esto](javascript:alert(1)).',
      );
    await comentario.getByRole('button', { name: /Ver el comentario/ }).click();

    const pintado = comentario.locator('.markdown');
    await expect(pintado.getByRole('heading', { name: 'Hallazgo' })).toBeVisible();
    await expect(pintado.locator('strong')).toHaveText('enero');
    await expect(pintado.locator('li')).toHaveCount(2);

    // El enlace legítimo es un enlace; el `javascript:` NO existe como enlace y su texto sigue a la
    // vista, para que quien lea la celda pueda ver lo que alguien intentó.
    await expect(pintado.getByRole('link', { name: 'la consola' })).toHaveAttribute(
      'href',
      '/sql-console',
    );
    await expect(pintado.getByRole('link', { name: 'esto' })).toHaveCount(0);
    await expect(pintado).toContainText('javascript:alert(1)');

    await page.screenshot({ path: `${EVIDENCIA}/11-comentario-markdown.png`, fullPage: true });
  });
});
