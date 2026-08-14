import { expect, test } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';

/**
 * El EXTRACTO BANCARIO clasificado de punta a punta, contra el motor real.
 *
 * Convierte un extracto y clasifica sus movimientos con el worker semántico de
 * verdad, y exige lo único que un simulado no puede prometer: que **ningún
 * movimiento se quede sin categoría**.
 *
 * Existe por un fallo que ninguna prueba veía. La tabla salía casi entera con
 * «Sin determinar» —«PAGO QR COMERCIO», «PAGO SERVICIO INTERNET», «COMPRA
 * TARJETA POS»— aunque el catálogo tenía la hoja de cada una sembrada y el
 * modelo las reconocía con holgura. La causa no estaba ni en el catálogo ni en
 * el umbral: el motor deduplica los análisis por CONTENIDO y sin caducidad, así
 * que el portal recibía el veredicto calculado contra el catálogo de meses
 * antes, y volver a pulsar devolvía exactamente el mismo. Un simulado habría
 * seguido en verde para siempre: la caché que rompía esto vive en el motor.
 *
 * Por eso lo que se afirma es el RESULTADO, no la llamada. Comprobar que el
 * portal manda una clave de idempotencia sería comprobar la implementación de
 * hoy; comprobar que la tabla queda clasificada seguirá valiendo si mañana el
 * arreglo vive en otro sitio.
 */

test.describe.configure({ mode: 'serial' });

test.describe('extracto bancario · clasificación con el motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  test('todos los movimientos del extracto caen en alguna categoría', async ({ page }) => {
    // Una ejecución del semántico por glosa distinta, de cuatro en cuatro y con
    // sondeos: el minuto largo es el coste real de preguntar al modelo, no una
    // holgura por si acaso.
    test.setTimeout(12 * 60_000);

    await entrar(page);
    await page.goto('/workers/bank-statement', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // La vista abre en «Panel de control»; la consola —el formulario— es la otra
    // pestaña. Sin este paso se esperaba a un formulario que no estaba montado.
    const consola = page.getByRole('tab', { name: 'Consola' });
    await expect(
      consola,
      'no apareció la pestaña «Consola»: casi siempre es la cuota del motor ' +
        'agotada por correr este archivo junto al barrido. Córrelo solo.',
    ).toBeVisible({ timeout: 60_000 });
    await consola.click();

    const hechos = page.locator('.worker-facts');
    await expect(hechos).not.toHaveClass(/is-loading/, { timeout: 30_000 });
    const estado = await hechos.innerText();
    test.skip(/Apagado en este entorno/i.test(estado), 'Worker de extractos apagado.');

    // Escenario del catálogo: es el extracto que el motor sirve a todo el mundo,
    // así que lo que aquí se mida vale para cualquiera que abra la consola.
    await page.getByRole('radio', { name: /Usar datos de prueba/i }).check();
    /*
     * «Extracto completo» y no el primero de la lista, que es el mínimo: dos
     * movimientos, ambos de manual, y una prueba que los clasifica no distingue
     * un catálogo sano de uno con la mitad de las hojas. Se elige por su nombre
     * para que reordenar el catálogo de escenarios no cambie en silencio lo que
     * se mide.
     */
    await page.getByLabel('Escenario').selectOption({ label: 'Extracto completo' });
    await page.getByRole('button', { name: 'Convertir' }).click();

    await expect(page.locator('.worker-table-scroll table')).toBeVisible({ timeout: 5 * 60_000 });
    const filas = page.locator('.worker-table-scroll tbody tr');
    // Sin este piso, un escenario que devolviera cero movimientos pasaría la
    // prueba entera: no habría ninguna celda «Sin determinar» que contar.
    await expect(filas).not.toHaveCount(0);

    const clasificar = page.getByRole('button', { name: /Clasificar \d+ glosas distintas/ });
    await expect(clasificar).toBeVisible({ timeout: 60_000 });
    await clasificar.click();

    // El botón vuelve cuando la tanda entera terminó: mientras corre, la barra
    // enseña «Parar». Esperar al botón es esperar al final de verdad, no a que
    // la primera fila se haya pintado.
    await expect(page.getByRole('button', { name: /Volver a clasificar/ })).toBeVisible({
      timeout: 10 * 60_000,
    });

    // Ni una sola celda sin categoría. El mensaje del fallo lleva las glosas que
    // se quedaron fuera: sin ellas, «esperaba 0, recibí 7» no dice qué mirar.
    const sinCategoria = page.locator('.worker-faint', { hasText: /^Sin determinar$/ });
    const cuantas = await sinCategoria.count();
    const filasSinCategoria: string[] = [];
    for (let i = 0; i < cuantas; i += 1) {
      const fila = sinCategoria.nth(i).locator('xpath=ancestor::tr[1]');
      filasSinCategoria.push((await fila.innerText()).replace(/\s+/g, ' ').trim());
    }
    expect(
      filasSinCategoria,
      'estos movimientos se quedaron sin categoría; si su hoja existe en el ' +
        'catálogo, sospecha del veredicto guardado de una corrida anterior',
    ).toEqual([]);

    // Y que la clasificación diga algo. Una tabla con «No se pudo» en todas las
    // filas también tendría cero «Sin determinar»: contar las que SÍ llevan
    // código de categoría es lo que separa «clasificado» de «no contestó».
    await expect(page.locator('.worker-categoria code')).toHaveCount(await filas.count());
  });
});
