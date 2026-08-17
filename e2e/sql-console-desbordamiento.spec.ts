import { expect, test, type Page } from '@playwright/test';
import { mockSqlConsoleBackend } from './support/sql-console-backend';

/**
 * La consola SQL no estira la página, se desplaza por dentro.
 *
 * **El defecto que esto cierra.** El armazón de la consola llevaba
 * `min-height: calc(100dvh - …)`, es decir un alto MÍNIMO y no un alto. Toda su
 * cadena de desplazamiento interno —`.sql-workspace` con su fila
 * `minmax(0, 1fr)`, `.sql-results` con `overflow: hidden`, `.sql-results__body`
 * con `overflow: auto`— está construida para repartir un alto acotado, y sin
 * techo no llegaba a activarse nunca: un resultado de miles de filas estiraba el
 * grid, con él el documento, y quien se desplazaba perdía de vista el editor y
 * la cabecera de la tabla — que es exactamente lo que hay que tener delante para
 * leer la fila diez mil.
 *
 * **Por qué se mide con un resultado LARGO.** Con las tres filas del simulado
 * normal la tabla cabe en cualquier alto y el desbordamiento no ocurre: la
 * prueba pasaría igual estando el defecto sin arreglar. `MUCHAS_FILAS` devuelve
 * trescientas.
 */

const RUTA = '/sql-console';

/**
 * Ejecuta una consulta y espera a que la rejilla tenga filas de verdad.
 *
 * Se escribe con teclado real y no inyectando en el modelo de Monaco, igual que
 * en `sql-console.spec.ts`: la consulta viaja por `onChange`, y escribir por
 * debajo no comprobaría que ese cable existe.
 */
async function ejecutar(page: Page, consulta: string): Promise<void> {
  const editor = page.locator('.sql-editor .monaco-editor').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(consulta, { delay: 1 });
  await page.getByRole('button', { name: /Ejecutar/ }).click();
  await expect(page.locator('.sql-results__body table tbody tr').first()).toBeVisible({
    timeout: 60_000,
  });
}

async function abrir(page: Page, ancho: number, alto: number): Promise<void> {
  await mockSqlConsoleBackend(page);
  await page.setViewportSize({ width: ancho, height: alto });
  // 120 s en la PRIMERA navegación: en desarrollo Turbopack compila esta ruta al
  // pedirla y arrastra Monaco entero. Con 60 s falla por reloj, no por defecto.
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.locator('.sql-console')).toBeVisible({ timeout: 60_000 });
  // Sin esperar a que Monaco monte, lo que se teclea se pierde.
  await expect(page.locator('.sql-editor .monaco-editor').first()).toBeVisible({
    timeout: 60_000,
  });
}

test.describe('desbordamiento de la consola SQL', () => {
  test.setTimeout(180_000);

  test('pasar de 3 filas a 300 NO hace crecer la consola ni el documento', async ({ page }) => {
    /*
     * El invariante EXACTO del defecto, y por eso se mide comparando dos
     * consultas en vez de contra un número.
     *
     * Un umbral absoluto («el documento mide menos de X») dependería del alto de
     * la cabecera y de la tarjeta explicativa, que cambian con el ancho y con si
     * el aviso de sesión aparece — un número así se rompe al reescribir un
     * título. Lo que nunca puede pasar, mida lo que mida la página, es que
     * DEVOLVER MÁS FILAS la agrande: el resultado va dentro de un panel con
     * techo. Con el defecto, 300 filas dejaban la consola en 19.803 px.
     */
    await abrir(page, 1440, 900);

    await ejecutar(page, 'SELECT artefacto FROM decisiones.ejecuciones');
    const pocas = await page.evaluate(() => ({
      consola: Math.round(document.querySelector('.sql-console')!.getBoundingClientRect().height),
      documento: document.documentElement.scrollHeight,
    }));

    await ejecutar(page, 'SELECT * FROM decisiones MUCHAS_FILAS');
    const muchas = await page.evaluate(() => ({
      consola: Math.round(document.querySelector('.sql-console')!.getBoundingClientRect().height),
      documento: document.documentElement.scrollHeight,
      ventana: document.documentElement.clientHeight,
      filas: document.querySelectorAll('.sql-results__body table tbody tr').length,
    }));

    // El simulado devolvió de verdad las 300: sin esto la prueba pasaría por no
    // haber llegado nunca el resultado grande.
    expect(muchas.filas).toBeGreaterThan(200);

    /*
     * El crecimiento está acotado por el TECHO, no por el número de filas, y esa
     * es la afirmación central.
     *
     * No se exige que no crezca nada: con tres filas la consola se queda en su
     * suelo y con trescientas sube hasta su techo, que es el comportamiento que
     * se quiere —compacta cuando cabe, una pantalla cuando no—. Lo que no puede
     * pasar es que crezca CON las filas: cien veces más filas producían 19.803 px
     * de consola, y aquí la diferencia entera tiene que caber en un par de
     * cientos de píxeles.
     */
    const creceConsola = muchas.consola - pocas.consola;
    const creceDocumento = muchas.documento - pocas.documento;
    expect(creceConsola).toBeLessThan(400);
    expect(creceDocumento).toBeLessThan(400);

    // Y el techo está donde se cree: cabe en una pantalla.
    expect(muchas.consola).toBeLessThanOrEqual(muchas.ventana);
  });

  test('la rejilla sí se desplaza por dentro', async ({ page }) => {
    await abrir(page, 1440, 900);
    await ejecutar(page, 'SELECT * FROM decisiones MUCHAS_FILAS');

    const cuerpo = page.locator('.sql-results__body');
    const desplazable = await cuerpo.evaluate((nodo) => nodo.scrollHeight - nodo.clientHeight);
    // Si esto es 0, el contenido no está acotado: no hay nada que desplazar
    // porque el panel creció hasta caber entero, que es el defecto original.
    expect(desplazable).toBeGreaterThan(50);

    // Y se desplaza de verdad: mover la rejilla NO mueve la página. Es la
    // afirmación central — con el defecto, el único desplazamiento posible era
    // el del documento.
    const antes = await page.evaluate(() => window.scrollY);
    await cuerpo.evaluate((nodo) => nodo.scrollTo(0, 400));
    const despues = await page.evaluate(() => ({
      dentro: document.querySelector('.sql-results__body')?.scrollTop ?? 0,
      pagina: window.scrollY,
    }));
    expect(despues.dentro).toBeGreaterThan(300);
    expect(despues.pagina).toBe(antes);
  });

  test('el editor sigue a la vista tras desplazar la rejilla', async ({ page }) => {
    // Es la consecuencia que hacía inservible el defecto: para leer una fila hay
    // que poder ver a la vez la consulta que la produjo.
    await abrir(page, 1440, 900);
    await ejecutar(page, 'SELECT * FROM decisiones MUCHAS_FILAS');
    await page.locator('.sql-results__body').evaluate((nodo) => nodo.scrollTo(0, 2000));

    await expect(page.locator('.sql-editor')).toBeInViewport();
  });

  test('en pantalla estrecha la rejilla tampoco crece sin fin', async ({ page }) => {
    /*
     * Apilado, la página SÍ se desplaza —es lo natural con el contenido en
     * columna— pero la rejilla lleva su propio techo. Sin él volvería el mismo
     * defecto, sólo que en móvil.
     */
    await abrir(page, 390, 844);
    await ejecutar(page, 'SELECT * FROM decisiones MUCHAS_FILAS');

    const alto = await page
      .locator('.sql-results')
      .evaluate((nodo) => nodo.getBoundingClientRect().height);
    expect(alto).toBeLessThanOrEqual(844 * 0.75);
  });

  test('no aparece desplazamiento HORIZONTAL de página por la tabla', async ({ page }) => {
    // Una tabla ancha debe desplazarse dentro de su contenedor, nunca empujar el
    // ancho del documento.
    await abrir(page, 390, 844);
    await ejecutar(page, 'SELECT * FROM decisiones MUCHAS_FILAS');

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(2);
  });
});
