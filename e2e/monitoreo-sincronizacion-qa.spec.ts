import { expect, test, type Page } from '@playwright/test';
import { QA_RUNS, monitoringBackend } from './support/monitoring-backend';

/**
 * La sincronización entre el QA Lab y el monitoreo del modelo.
 *
 * Las dos pantallas medían la misma versión sin saberlo la una de la otra: quien vigila la
 * degradación no podía ver la última prueba de esfuerzo, y una versión recién desplegada —que
 * todavía no tiene ni un desenlace observado— dejaba el tablero vacío justo cuando más falta
 * hace saber si aguanta.
 *
 * Lo que se comprueba aquí no es que la tabla pinte, sino las tres formas de mentir con estos
 * números: contar una corrida viva como instantánea, comparar dos corridas configuradas
 * distinto y llamarlo degradación, y dejar que la carga sintética se lea como evidencia
 * observada.
 */
async function elegirVersion(page: Page) {
  await monitoringBackend(page);
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.goto('/model-monitoring', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Monitoreo del modelo');
  await page.getByLabel(/^Artefacto/).selectOption('CREDIT_ORIGINATION');
  await page.getByLabel(/^Versión a monitorear/).selectOption('4001');
}

function carril(page: Page) {
  return page.locator('.panel').filter({ hasText: 'Sincronización con QA Lab' });
}

test('la serie de estrés aparece al elegir la versión, sin medir nada', async ({ page }) => {
  await elegirVersion(page);

  /*
   * Sin pulsar «Medir» a propósito. Los tres análisis de esta pantalla necesitan desenlaces
   * del libro de préstamos y una versión estrenada no tiene ninguno: si la serie de estrés
   * exigiera el mismo gesto, la única medida disponible en esa ventana de meses estaría
   * escondida detrás de un botón que no devuelve nada.
   */
  await expect(carril(page)).toBeVisible();
  await expect(carril(page)).toContainText('4 corridas archivadas');
  await expect(carril(page)).toContainText('5.800'); // 300 + 1500 + 4000 casos ejecutados
});

test('la carga sintética se declara y se mantiene fuera de las tasas', async ({ page }) => {
  await elegirVersion(page);

  // Es la línea que impide la lectura peligrosa: 5800 «decisiones» que no son de nadie, en la
  // misma pantalla donde se responde a un regulador por la tasa de malos de la cartera.
  await expect(carril(page)).toContainText('No entra en ninguna tasa de esta pantalla');
  await expect(carril(page).locator('.monitoring-note-synthetic')).toBeVisible();
});

test('una corrida viva no vale cero milisegundos por caso', async ({ page }) => {
  await elegirVersion(page);

  // La corrida 9004 está RUNNING con 0 casos cerrados. Dividir daría 0 ms/caso y la pintaría
  // como la más rápida de la serie, que es la lectura contraria a la verdadera.
  const viva = carril(page).locator('tbody tr').filter({ hasText: 'En marcha' });
  await expect(viva).toHaveCount(1);
  await expect(viva).toContainText('—');
  await expect(carril(page)).toContainText('3 de 4');
});

test('la degradación bajo carga sale con la configuración que la hace comparable', async ({
  page,
}) => {
  await elegirVersion(page);

  // 5 ms/caso con 300 casos → 10 ms/caso con 4000: el doble de caro bajo trece veces la carga.
  await expect(carril(page)).toContainText('×2.00');
  await expect(carril(page)).toContainText('5.00 ms');
  await expect(carril(page)).toContainText('10.00 ms');
  // Y la concurrencia a la vista, que es lo que permite creerse la comparación.
  await expect(carril(page).locator('tbody tr').last()).toContainText('1');
});

test('la tasa de violaciones llega con su denominador, y la corrida con fallos se señala', async ({
  page,
}) => {
  await elegirVersion(page);

  // 12 de 5800. Un porcentaje suelto no dice si son doce sobre cinco mil o doce sobre veinte.
  await expect(carril(page)).toContainText('12 de 5.800');
  await expect(carril(page).locator('tr.row-flagged')).toHaveCount(1);
});

test('dos corridas configuradas distinto NO se comparan', async ({ page }) => {
  await elegirVersion(page);

  /*
   * El fallo que esto impide es silencioso y caro. Con concurrencia 1 el motor despacha de uno
   * en uno y con 8 en paralelo: el coste por caso puede diferir en un orden de magnitud sin que
   * el motor se haya degradado nada, y el número saldría igual de convincente en pantalla.
   */
  await page.route('**/v1/qa-lab/runs*', (route) =>
    route.fulfill({
      json: {
        total: 2,
        items: [{ ...QA_RUNS.items[1], concurrency: 8 }, QA_RUNS.items[3]],
      },
    }),
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByLabel(/^Artefacto/).selectOption('CREDIT_ORIGINATION');
  await page.getByLabel(/^Versión a monitorear/).selectOption('4001');

  await expect(carril(page)).toContainText('Hacen falta dos corridas');
  await expect(carril(page)).toContainText('mediría la configuración y no el motor');
  await expect(carril(page)).not.toContainText('×');
});

test('una versión sin corridas lo dice, en vez de enseñar ceros', async ({ page }) => {
  await elegirVersion(page);
  await page.route('**/v1/qa-lab/runs*', (route) =>
    route.fulfill({ json: { total: 0, items: [] } }),
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByLabel(/^Artefacto/).selectOption('CREDIT_ORIGINATION');
  await page.getByLabel(/^Versión a monitorear/).selectOption('4001');

  await expect(carril(page)).toContainText('Esta versión no se ha sometido a estrés');
  // Y dice cómo se arregla, con la condición que hace legible la serie.
  await expect(carril(page)).toContainText('MISMA concurrencia');
});
