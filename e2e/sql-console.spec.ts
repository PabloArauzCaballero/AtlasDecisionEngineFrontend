import { expect, test, type Page } from '@playwright/test';
import { collectProblems } from './support/backend-mock';
import { mockSqlConsoleBackend } from './support/sql-console-backend';

/**
 * La consola de consultas SQL, con TODOS sus controles pulsados.
 *
 * No es una prueba de humo. Un panel con explorador, pestañas, editor y tres vistas de
 * resultado tiene una veintena de botones, y el fallo típico de una pantalla así no es que
 * no cargue: es que uno de esos botones no haga nada. Un `onClick` que no está cableado se
 * ve exactamente igual que uno que sí lo está, así que aquí cada control se pulsa y se
 * comprueba su EFECTO, no que exista.
 */

const RUTA = '/sql-console';

/**
 * Localizadores por CLASE y no por nombre accesible.
 *
 * Cada fila del explorador tiene dos botones —abrir la tabla e insertarla en la consulta— y
 * el segundo se llama «Insertar decisiones.ejecuciones…», que contiene el nombre del
 * primero. Buscar por nombre casa con los dos y falla por ambigüedad. Los nombres son
 * correctos y descriptivos, que es lo que importa para quien usa un lector de pantalla; la
 * prueba es la que tiene que decir a cuál de los dos se refiere.
 */
const tabla = (page: Page, nombre: string) =>
  page.locator('.sql-explorer__table', { hasText: new RegExp(`^${nombre}$`) });
const dataset = (page: Page, nombre: string) =>
  page.locator('.sql-explorer__dataset-head', { hasText: nombre });

async function abrirConsola(page: Page) {
  await mockSqlConsoleBackend(page);
  /*
   * 120 s para la PRIMERA navegación, no 60.
   *
   * En desarrollo, Turbopack compila la ruta la primera vez que se pide, y ésta arrastra
   * Monaco entero. La prueba que llegaba primera fallaba por reloj y no por defecto —las
   * nueve siguientes pasaban en segundos—, que es exactamente la prueba inestable que
   * enseña a reintentar en vez de a mirar.
   */
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.sql-console')).toBeVisible({ timeout: 30_000 });
  // El editor de Monaco tarda en montar; sin esperarlo, escribir se pierde.
  await expect(page.locator('.sql-editor .monaco-editor').first()).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Escribe en el editor sustituyendo lo que hubiera.
 *
 * Se hace con teclado real y no inyectando en el modelo de Monaco: la consulta viaja por
 * `onChange`, y una prueba que escribiera en el modelo por debajo no comprobaría que ese
 * cable existe, que es justo lo que se rompe al refactorizar el editor.
 */
async function escribir(page: Page, sql: string) {
  const editor = page.locator('.sql-editor .monaco-editor').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.type(sql, { delay: 1 });
  // Cierra el globo de sugerencias si quedó abierto: mientras está abierto se traga el
  // Ctrl+Enter con el que otra prueba ejecuta, y el fallo saldría en la prueba siguiente.
  await page.keyboard.press('Escape');
}

test.describe('consola de consultas SQL', () => {
  test.setTimeout(180_000);

  test('la entrada del menú está en Procesamiento y lleva a la consola', async ({ page }) => {
    await abrirConsola(page);

    const cajon = page.locator('.sidebar');
    await expect(cajon.getByRole('link', { name: 'Consultas SQL' })).toBeVisible();
    // Workers bajó a «Operación»; que siga alcanzable es parte del cambio, no un detalle.
    await expect(cajon.getByRole('link', { name: 'Workers' })).toBeVisible();
  });

  test('el explorador abre datasets, filtra y alimenta el editor', async ({ page }) => {
    const problems = collectProblems(page);
    await abrirConsola(page);

    const explorador = page.locator('.sql-explorer');
    await expect(dataset(page, 'decisiones')).toBeVisible();
    await expect(tabla(page, 'ejecuciones')).toBeVisible();

    // Plegar: la tabla desaparece. Es el efecto, no el atributo.
    await dataset(page, 'decisiones').click();
    await expect(tabla(page, 'ejecuciones')).toBeHidden();
    await dataset(page, 'decisiones').click();
    await expect(tabla(page, 'ejecuciones')).toBeVisible();

    // Buscar por nombre de COLUMNA, que es el caso que un árbol ingenuo no resuelve: quien
    // busca «desenlace» no sabe todavía en qué tabla está.
    await explorador.getByRole('searchbox').fill('desenlace');
    await expect(tabla(page, 'observaciones')).toBeVisible();
    await expect(tabla(page, 'ejecuciones')).toBeHidden();

    await explorador.getByRole('searchbox').fill('');
    await expect(tabla(page, 'ejecuciones')).toBeVisible();

    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('la ficha de tabla enseña el grano y sus botones escriben la consulta', async ({ page }) => {
    await abrirConsola(page);

    await tabla(page, 'ejecuciones').click();

    const ficha = page.locator('.sql-schema');
    await expect(ficha).toBeVisible();
    // El grano es la frase que evita contar filas de detalle creyendo contar entidades.
    await expect(ficha.locator('.sql-schema__grain')).toContainText('Una fila =');
    await expect(ficha.getByRole('row', { name: /duracion_ms/ })).toBeVisible();

    await ficha.getByRole('button', { name: 'Consultar esta tabla' }).click();
    await expect(page.locator('.sql-editor')).toContainText('decisiones.ejecuciones');

    // Insertar una columna añade su nombre a lo ya escrito, no lo sustituye.
    await ficha.getByRole('button', { name: /Insertar la columna duracion_ms/ }).click();
    await expect(page.locator('.sql-editor')).toContainText('duracion_ms');

    await ficha.getByRole('button', { name: 'Cerrar el esquema' }).click();
    await expect(ficha).toBeHidden();
  });

  test('ejecutar devuelve filas, y las tres vistas del resultado responden', async ({ page }) => {
    const problems = collectProblems(page);
    await abrirConsola(page);

    await escribir(page, 'SELECT artefacto, estado FROM decisiones.ejecuciones');
    await page.getByRole('button', { name: 'Ejecutar' }).click();

    const resultados = page.locator('.sql-results');
    await expect(resultados.locator('.sql-grid')).toBeVisible({ timeout: 30_000 });
    await expect(resultados.locator('.sql-grid tbody tr')).toHaveCount(3);
    await expect(resultados.locator('.sql-results__summary')).toContainText('3');

    // `null` se pinta como «null» y apagado: en un LEFT JOIN esa celda ES el hallazgo, y
    // confundirla con vacío invierte la lectura de la consulta.
    await expect(resultados.locator('.sql-grid td.is-null').first()).toHaveText('null');

    await resultados.getByRole('tab', { name: 'JSON' }).click();
    await expect(resultados.locator('.sql-results__json')).toContainText('SCORING_CREDITO');

    await resultados.getByRole('tab', { name: 'Detalles de ejecución' }).click();
    await expect(resultados.locator('.sql-results__details')).toContainText('Filas estimadas');
    await expect(resultados.locator('.sql-results__details')).toContainText(
      'decisiones.ejecuciones',
    );

    await resultados.getByRole('tab', { name: 'Resultados' }).click();
    await expect(resultados.locator('.sql-grid')).toBeVisible();

    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('Ctrl+Enter ejecuta sin tocar el botón', async ({ page }) => {
    await abrirConsola(page);

    await escribir(page, 'SELECT estado FROM decisiones.ejecuciones');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(page.locator('.sql-results .sql-grid')).toBeVisible({ timeout: 30_000 });
  });

  test('una consulta rechazada se explica en el panel, no como error de red', async ({ page }) => {
    await abrirConsola(page);

    await escribir(page, 'DELETE FROM decisiones.ejecuciones');
    await page.getByRole('button', { name: 'Ejecutar' }).click();

    const bloqueado = page.locator('.sql-results--blocked');
    await expect(bloqueado).toBeVisible({ timeout: 30_000 });
    await expect(bloqueado).toContainText('sólo ejecuta consultas');
    // Y no queda una rejilla vieja debajo diciendo lo contrario.
    await expect(page.locator('.sql-grid')).toHaveCount(0);
  });

  test('el reloj agotado se distingue de un rechazo', async ({ page }) => {
    await abrirConsola(page);

    await escribir(page, 'SELECT 1 FROM decisiones.ejecuciones -- LENTA');
    await page.getByRole('button', { name: 'Ejecutar' }).click();

    await expect(page.locator('.sql-results--blocked')).toContainText('superó el límite', {
      timeout: 30_000,
    });
  });

  test('un resultado cortado lo dice ARRIBA y antes de la tabla', async ({ page }) => {
    await abrirConsola(page);

    await escribir(page, 'SELECT * FROM decisiones.ejecuciones -- TRUNCADA');
    await page.getByRole('button', { name: 'Ejecutar' }).click();

    const aviso = page.locator('.sql-results__truncated');
    await expect(aviso).toBeVisible({ timeout: 30_000 });
    await expect(aviso).toContainText('10.000');

    // Al pie sólo lo vería quien llega al final, que es justo quien ya no lo necesita.
    const avisoY = (await aviso.boundingBox())?.y ?? 0;
    const tablaY = (await page.locator('.sql-grid').boundingBox())?.y ?? 0;
    expect(avisoY).toBeLessThan(tablaY);
  });

  test('las pestañas se abren, guardan su texto por separado y se cierran', async ({ page }) => {
    await abrirConsola(page);

    await escribir(page, 'SELECT 1 FROM decisiones.motivos');
    await page.getByRole('button', { name: 'Nueva consulta' }).click();

    const pestanas = page.locator('.sql-tabs__item');
    await expect(pestanas).toHaveCount(2);

    await escribir(page, 'SELECT 2 FROM desenlaces.observaciones');
    await expect(page.locator('.sql-editor')).toContainText('desenlaces.observaciones');

    // Volver a la primera devuelve SU texto: si las pestañas compartieran estado, aquí se
    // vería la segunda consulta y nadie lo notaría hasta perder trabajo.
    await pestanas.first().getByRole('tab').click();
    await expect(page.locator('.sql-editor')).toContainText('decisiones.motivos');

    await pestanas
      .last()
      .getByRole('button', { name: /^Cerrar/ })
      .click();
    await expect(pestanas).toHaveCount(1);
  });

  test('el historial enseña los rechazos y reabre una consulta', async ({ page }) => {
    await abrirConsola(page);

    await page.locator('.sql-side').getByRole('tab', { name: 'Historial' }).click();

    const historial = page.locator('.sql-history');
    await expect(historial.locator('li')).toHaveCount(2);
    // Un historial que esconde los rechazos deja sin la mitad de lo que enseña la superficie.
    await expect(historial).toContainText('Rechazada');
    await expect(historial).toContainText('SQL_NOT_A_QUERY');

    await historial.locator('li').first().getByRole('button').click();
    await expect(page.locator('.sql-editor')).toContainText('count(*)');
  });
});
