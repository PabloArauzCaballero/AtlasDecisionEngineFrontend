import { expect, test } from '@playwright/test';
import { collectProblems } from './support/backend-mock';
import { desbordes, editorTablesBackend } from './support/editor-tables-backend';

/**
 * Cuatro defectos de composición que se veían a simple vista y que ninguna
 * prueba detectaba, porque todas medían vistas VACÍAS o magnitudes que el
 * propio CSS mantiene constantes. Cada uno se fija aquí con el número que lo
 * delató.
 */

const ESCRITORIO = { width: 1440, height: 900 };

test.beforeEach(async ({ page }) => {
  await editorTablesBackend(page);
  await page.setViewportSize(ESCRITORIO);
});

/**
 * El lienzo es lo único que esta pantalla existe para manipular, y estaba
 * empezando en y≈1380 porque los cinco paneles de datos se apilaban desplegados
 * encima. Se entraba al editor de grafo y no se veía el grafo.
 */
test('el editor de grafo enseña el lienzo sin hacer scroll', async ({ page }) => {
  const problemas = collectProblems(page);
  await page.goto('/graph-editor');
  await page.waitForSelector('.graph-workbench', { timeout: 30_000 });

  const lienzo = await page.locator('.graph-canvas').boundingBox();
  expect(lienzo, 'el lienzo debe existir').not.toBeNull();
  expect(
    lienzo!.y,
    'el lienzo arrancaba en y≈1380: si vuelve a subir el número, algo por encima se está desplegando de entrada',
  ).toBeLessThan(350);

  /*
   * Y no sólo asoma por el borde: se ve superficie de trabajo de verdad. No se
   * exige que quepa ENTERO —el lienzo mide 620-660 px y por encima hay barra
   * del portal, banner, barra del editor, paso a paso y la sección plegada—,
   * sino que lo visible sirva para dibujar.
   */
  const visible = Math.min(lienzo!.y + lienzo!.height, ESCRITORIO.height) - lienzo!.y;
  expect(visible, 'apenas se ve una franja del lienzo').toBeGreaterThan(450);

  // Las dos secciones nacen plegadas, y su resumen dice lo que hay dentro para
  // que plegarlas no esconda nada.
  const cabeceras = page.locator('.editor-section h2 button');
  await expect(cabeceras).toHaveCount(2);
  for (const cabecera of await cabeceras.all()) {
    await expect(cabecera).toHaveAttribute('aria-expanded', 'false');
    await expect(cabecera.locator('.editor-section-summary')).not.toBeEmpty();
  }
  expect(problemas).toEqual([]);
});

test('la sección de datos se despliega y vuelve a plegarse', async ({ page }) => {
  await page.goto('/graph-editor');
  await page.waitForSelector('.graph-workbench', { timeout: 30_000 });

  const datos = page.locator('.editor-section h2 button').first();
  await datos.click();
  await expect(datos).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.input-contract-panel')).toBeVisible();

  await datos.click();
  await expect(datos).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.input-contract-panel')).toHaveCount(0);
});

/**
 * `main` es un ítem de grid con `min-width: auto`, así que se negaba a
 * encogerse por debajo de su tabla: con 22 casos iba de x=550 a x=1918 con el
 * marco acabando en 1440. Como `.app-shell` recorta, esos 478 px no producían
 * barra de desplazamiento y los botones de la cabecera quedaban inalcanzables.
 */
test('los casos de prueba caben en su columna con payloads reales', async ({ page }) => {
  await page.goto('/test-cases');
  await page.waitForSelector('.test-cases-layout', { timeout: 30_000 });
  await page.selectOption('.filter-bar select', '4');
  await page.getByRole('button', { name: /cargar casos/i }).click();
  await expect(page.locator('tbody tr')).not.toHaveCount(0);

  expect(await desbordes(page), 'la tabla volvió a sacar su columna del marco').toEqual([]);

  // Los botones de la cabecera son el síntoma que se veía: si `main` desborda,
  // se van fuera de la pantalla y no hay forma de pulsarlos.
  await expect(page.getByRole('button', { name: /Ejecutar Suite/i })).toBeInViewport();

  // Y la tabla se desplaza DENTRO de su caja en vez de estirar el layout.
  const cabe = await page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>('.table-wrap');
    const main = document.querySelector<HTMLElement>('.test-cases-layout > main');
    return {
      minWidth: main ? getComputedStyle(main).minWidth : null,
      tablaCabe: wrap ? wrap.scrollWidth <= wrap.clientWidth + 1 : false,
    };
  });
  expect(cabe.minWidth, '`main` debe poder encogerse: sin esto la tabla lo ensancha').toBe('0px');
  expect(cabe.tablaCabe).toBe(true);
});

/**
 * Las celdas volcaban `JSON.stringify()` entero y la tabla truncaba medio
 * objeto, que no identifica ningún caso. Ahora se resume y el contenido está a
 * un clic, formateado y sin desplazamiento horizontal.
 */
test('un caso se despliega y enseña sus payloads legibles', async ({ page }) => {
  await page.goto('/test-cases');
  await page.waitForSelector('.test-cases-layout', { timeout: 30_000 });
  await page.selectOption('.filter-bar select', '4');
  await page.getByRole('button', { name: /cargar casos/i }).click();

  const primero = page.locator('.case-toggle').first();
  await expect(primero).toBeVisible();
  // Resumen en la celda, no el objeto crudo.
  await expect(page.locator('.case-summary strong').first()).toHaveText('8 campos');

  await primero.click();
  await expect(page.locator('.case-detail')).toBeVisible();
  // El visor presenta campo→valor: el payload se lee sin descifrar JSON.
  await expect(page.locator('.case-detail').getByText('monthly_income')).toBeVisible();
  expect(await desbordes(page), 'el detalle desplegado desborda su fila').toEqual([]);
});

/**
 * La barra superior está pegada al borde (`position: sticky; top: 0`), así que
 * un globo anclado con `bottom: 100%` se pintaba ARRIBA de la ventana: medido,
 * `y = -19,5`. Se abría y no se veía nunca.
 */
test('los tooltips de la barra superior se ven', async ({ page }) => {
  await page.goto('/platform-health');
  await page.waitForSelector('.topbar', { timeout: 30_000 });

  const envoltorio = page.locator('.topbar .tooltip-wrap').first();
  await expect(envoltorio).toBeVisible();
  await envoltorio.hover();

  const globo = page.locator('.topbar .tooltip-bubble').first();
  const caja = await globo.boundingBox();
  expect(caja, 'el globo debe tener caja al pasar el ratón').not.toBeNull();
  expect(caja!.y, 'el globo se pintaba en y negativa, fuera de la ventana').toBeGreaterThan(0);
  expect(caja!.y + caja!.height).toBeLessThanOrEqual(ESCRITORIO.height);

  /*
   * Y con su ancho natural: un absoluto sin `width` se ajusta al hueco de su
   * bloque contenedor —un botón de 38 px—, y el globo salía de 78 px de ancho
   * por 138 de alto, seis renglones de una palabra cada uno.
   */
  expect(caja!.width, 'el globo se está encogiendo al ancho de su botón').toBeGreaterThan(120);
  expect(caja!.height).toBeLessThan(100);
});
