import { expect, test, type Page } from '@playwright/test';
import { monitoringBackend } from './support/monitoring-backend';

/**
 * Las dos vistas que le dan cara al trabajo que el motor ya hacía sin que nadie lo viera:
 * el monitoreo continuo del modelo y los derechos del titular.
 *
 * Van contra un motor simulado CON DATOS, no contra el genérico: éste devuelve listados vacíos, y
 * una prueba escrita contra él mediría cabeceras y estados vacíos creyendo que mide la vista.
 *
 * Lo que se comprueba no es que las tablas pinten, sino que los avisos que hacen útil cada
 * pantalla aparezcan cuando toca: la entrega truncada, el grupo por debajo del umbral y la
 * población que se ha vuelto otra. Sin ellos, las dos vistas tranquilizan en vez de vigilar.
 */

async function abrirMonitoreo(page: Page) {
  await monitoringBackend(page);
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.goto('/model-monitoring', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Monitoreo del modelo');
}

async function medir(page: Page) {
  /*
   * Los selectores se anclan al PRINCIPIO del nombre accesible. El `<label>` de `PickerSelect`
   * envuelve al `<select>`, así que su nombre accesible arrastra el texto de la opción por
   * omisión: el de la versión acaba llamándose «Versión a monitorearElige primero un artefacto»,
   * que contiene «artefacto» y hace ambigua cualquier búsqueda por subcadena.
   */
  await page.getByLabel(/^Artefacto/).selectOption('CREDIT_ORIGINATION');
  await page.getByLabel(/^Versión a monitorear/).selectOption('4001');
  await page.getByLabel('Variable a comparar').fill('ingresos_mensuales');
  await page.getByLabel('Atributo de sesgo').fill('AGE_BAND');
  await page.getByLabel('Referencia — desde').fill('2025-07-01');
  await page.getByLabel('Referencia — hasta').fill('2025-12-31');
  await page.getByRole('button', { name: 'Medir' }).click();
}

test('el desempeño enseña los falsos rechazos, no sólo la tasa de malos', async ({ page }) => {
  await abrirMonitoreo(page);
  await medir(page);

  const panel = page.locator('.panel').filter({ hasText: 'Desempeño observado' });
  await expect(panel).toContainText('12.4 %');
  // La medida que casi nadie mira: los rechazados que se habrían comportado bien. Sin ella, un
  // modelo que se ha vuelto demasiado restrictivo parece impecable — sus malos nunca entraron.
  await expect(panel).toContainText('Falsos rechazos');
  await expect(panel).toContainText('18.3 %');
});

test('avisa de las observaciones que quedan fuera de todo denominador', async ({ page }) => {
  await abrirMonitoreo(page);
  await medir(page);

  // 1200 observadas y 940 concluyentes: 260 en la zona gris. Contarlas como buenas inflaría el
  // acierto de la versión sin que nada avisara.
  await expect(page.locator('.panel').filter({ hasText: 'Desempeño observado' })).toContainText(
    '260',
  );
});

test('la estabilidad marca una población que ya es otra, y qué banda lo explica', async ({
  page,
}) => {
  await abrirMonitoreo(page);
  await medir(page);

  const panel = page.locator('.panel').filter({ hasText: 'Estabilidad poblacional' });
  await expect(panel).toContainText('0.312');
  await expect(panel).toContainText('UNSTABLE');
  // Las bandas van ordenadas por aportación: la primera es la que explica el desplazamiento.
  await expect(panel.locator('tbody tr').first()).toContainText('n:9');
});

test('el impacto adverso señala el grupo bajo el umbral sin concluir discriminación', async ({
  page,
}) => {
  await abrirMonitoreo(page);
  await medir(page);

  const panel = page.locator('.panel').filter({ hasText: 'Impacto adverso' });
  await expect(panel).toContainText('0.625');
  await expect(panel).toContainText('no concluye que haya discriminación');
  // Los grupos con muestra insuficiente se declaran: su razón sería ruido.
  await expect(panel).toContainText('18-25');
  await expect(panel.locator('tr.row-flagged')).toHaveCount(1);
});

test('derechos del titular: entrega los motivos comunicables y avisa si la lista está truncada', async ({
  page,
}) => {
  await monitoringBackend(page);
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.goto('/data-subject-requests', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Derechos del titular');

  await page.getByLabel('Referencia del titular').fill('CPF-12345678901');
  await page.getByRole('button', { name: 'Registrar y resolver' }).click();

  const panel = page.locator('.panel').filter({ hasText: 'Resolución' });
  await expect(panel).toContainText('Ingresos insuficientes');
  await expect(panel).toContainText('acción adversa');
  // El aviso que impide dar por entregado un derecho de acceso incompleto.
  await expect(panel).toContainText('esto no es el historial completo');
});

test('la referencia del titular no viaja nunca en la dirección', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (peticion) => urls.push(peticion.url()));

  await monitoringBackend(page);
  await page.goto('/data-subject-requests', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Referencia del titular').fill('CPF-12345678901');
  await page.getByRole('button', { name: 'Registrar y resolver' }).click();
  await expect(page.locator('.panel').filter({ hasText: 'Resolución' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver solicitudes anteriores' }).click();
  /*
   * Por REGIÓN y no por `.panel` con texto: el panel del formulario contiene el botón «Ver
   * solicitudes anteriores», así que el filtro por subcadena casaba con dos paneles y el modo
   * estricto tumbaba la prueba. El nombre accesible viene del encabezado del panel, que es
   * único —y comprobarlo por ahí verifica de paso que la sección está nombrada para quien
   * navega con lector de pantalla—.
   */
  await expect(page.getByRole('region', { name: 'Solicitudes anteriores' })).toBeVisible();

  // Un identificador en una URL acaba en el registro de acceso, en el proxy y en la traza. Que las
  // dos operaciones sean POST sólo sirve si el portal no lo cuela igualmente en la dirección.
  expect(urls.filter((url) => url.includes('CPF-12345678901'))).toEqual([]);
});
