import { expect, test } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';
import { deAplicacion, vigilar } from './support/real-portal-watch';
import { esperarVista } from './support/real-portal-sweep';

/**
 * El CIRCUITO de la decisión, contra el motor real.
 *
 * Las tres pantallas de medición existen porque el motor llevaba meses publicando la capacidad y
 * ninguna vista la pedía. Una prueba simulada aquí no valdría: comprobaría que la vista sabe
 * pintar la forma que este repositorio CREE que el motor devuelve, y el fallo original fue
 * justamente que nadie había comprobado esa creencia.
 *
 * Lo que se afirma no es que haya datos —contra una base real puede no haberlos— sino que las
 * vistas EXISTEN, responden, y distinguen «no hay» de «no se pudo medir». Esa distinción es el
 * núcleo del diseño: un `0 %` donde debería ir «—» convierte un sistema sin operación en una
 * alarma falsa, y las alarmas falsas se desactivan.
 */

test.describe.configure({ mode: 'serial' });

test.describe('circuito de la decisión · motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  test('la cobertura enseña sus dos ratios con denominador, o «—» si no se pudo medir', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    const problemas = vigilar(page, () => '/decision-quality');
    await entrar(page);

    await page.goto('/decision-quality', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);

    await expect(page.getByRole('heading', { name: /calidad de la decisión/i })).toBeVisible({
      timeout: 30_000,
    });

    // Los dos indicadores tienen que estar, con o sin datos. Que falten significaría que el
    // endpoint de cobertura no respondió, y eso es exactamente el silencio que hay que romper.
    const cobertura = page.getByText(/decisiones con solicitante/i).first();
    await expect(cobertura).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/ventanas vencidas observadas/i).first()).toBeVisible();

    /*
     * El valor es un porcentaje o un guion largo, nunca «NaN», «undefined» ni «null».
     * Es el fallo que este diseño evita: dividir por cero y publicar el resultado.
     */
    const tarjetas = await page.locator('.metric-card strong').allInnerTexts();
    expect(tarjetas.length).toBeGreaterThan(0);
    for (const valor of tarjetas) {
      expect(valor).not.toMatch(/NaN|undefined|null|Infinity/i);
    }

    // Y el denominador: sin él, un 100 % sobre tres decisiones se lee como un 100 % sobre veinte mil.
    const pistas = await page.locator('.metric-card small').allInnerTexts();
    expect(pistas.join(' ')).toMatch(/de \d+/);

    expect(deAplicacion(problemas), 'la vista no debe registrar errores de aplicación').toEqual([]);
  });

  test('las pestañas de desenlaces y cosechas responden sin datos inventados', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    const problemas = vigilar(page, () => '/decision-quality');
    await entrar(page);
    await page.goto('/decision-quality', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);

    for (const nombre of [/desenlaces/i, /cosechas/i]) {
      const pestana = page.getByRole('tab', { name: nombre }).first();
      test.skip((await pestana.count()) === 0, 'Esta build no expone las pestañas de calidad.');
      await pestana.click();
      await esperarVista(page);

      // Una cola vacía se dice con un estado vacío EXPLICADO, no con una tabla de cero filas que
      // parece un fallo de carga.
      const cuerpo = await page.locator('main').innerText();
      expect(cuerpo).not.toMatch(/NaN|\[object Object\]|undefined/i);
      expect(cuerpo.trim().length).toBeGreaterThan(50);
    }

    expect(deAplicacion(problemas)).toEqual([]);
  });

  test('el gobierno del riesgo distingue un límite que bloquea de uno que sólo mide', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    const problemas = vigilar(page, () => '/risk-governance');
    await entrar(page);

    await page.goto('/risk-governance', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);

    await expect(page.getByRole('heading', { name: /gobierno del riesgo/i })).toBeVisible({
      timeout: 30_000,
    });

    // Las cinco pestañas tienen que existir: cada una cubre una condición que, cuando falta, se
    // salta en silencio.
    for (const nombre of [
      /apetito/i,
      /calibración/i,
      /permisos/i,
      /reidentificación/i,
      /expediente/i,
    ]) {
      await expect(page.getByRole('tab', { name: nombre }).first()).toBeVisible();
    }

    const cuerpo = await page.locator('main').innerText();
    expect(cuerpo).not.toMatch(/NaN|\[object Object\]|undefined/i);

    expect(deAplicacion(problemas)).toEqual([]);
  });

  test('los derechos del titular no dejan la referencia en la URL', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await entrar(page);
    await page.goto('/data-subject-requests', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);

    const campo = page.getByRole('textbox').first();
    test.skip((await campo.count()) === 0, 'Esta build no expone el formulario del titular.');
    await campo.fill('PRUEBA-REFERENCIA-E2E');

    /*
     * La afirmación central de esa pantalla: la referencia del titular NO viaja en la URL, donde
     * acabaría en el registro de acceso del proxy y en la traza — sitios de los que no se borra.
     */
    expect(page.url()).not.toContain('PRUEBA-REFERENCIA-E2E');
  });
});
