import { expect, test, type Page } from '@playwright/test';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * La consola de locución, afirmada y fotografiada a la vez.
 *
 * Las dos cosas juntas a propósito, como en `contratos-y-desenlaces.spec.ts`:
 * una captura sin aserción no detecta nada, y una aserción sin captura no deja
 * ver si el resultado se lee. Lo que se comprueba aquí es lo que distingue a
 * este worker de los otros tres —que no hay texto libre, que el desenlace se
 * dice con todas las letras y que el audio suena— y las capturas quedan en
 * `docs/visual-evidence/locucion/`.
 *
 * **Cada captura espera una señal POSITIVA antes de dispararse.** Es la lección
 * que dejó la evidencia responsive: esperar a que un indicador de carga
 * DESAPAREZCA no distingue «no está» de «todavía no está», y así se llenó un
 * directorio con 440 fotos de un spinner.
 */

const OUT = 'docs/visual-evidence/locucion';
const RUTA = '/workers/audio-tts';

function capturar(page: Page, nombre: string) {
  return page.screenshot({ path: `${OUT}/${nombre}`, fullPage: true, animations: 'disabled' });
}

async function abrirConsola(page: Page) {
  await page.getByRole('tab', { name: 'Consola' }).click();
  const consola = page.locator('.worker-console');
  await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
  return consola;
}

test.beforeEach(async ({ page }) => {
  await mockWorkersBackend(page);
});

test('el panel de control del worker de locución mide su salud', async ({ page }) => {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Aterriza en el panel, no en el formulario: la primera pregunta ante un
  // servicio asíncrono es si está sano, no cómo mandarle trabajo.
  await expect(page.getByRole('heading', { name: 'Locución' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.worker-dashboard')).toBeVisible({ timeout: 30_000 });
  await capturar(page, '01-panel-de-control.png');
});

test('la consola locuta desde el catálogo, no desde un cuadro de texto libre', async ({ page }) => {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const consola = await abrirConsola(page);

  // El proveedor viaja en el catálogo del motor y la vista lo enseña: `fake`
  // sintetiza un audio que no es una voz, y quien lo escuche debe poder saberlo.
  await expect(consola.getByText('fake', { exact: false }).first()).toBeVisible({
    timeout: 30_000,
  });
  await capturar(page, '02-consola-escenarios.png');

  await consola.getByRole('radio', { name: /Elegir una plantilla/ }).check();
  await consola.locator('select').first().selectOption('onboarding.welcome.named');

  /*
   * La plantilla decide qué se puede decir Y qué hay que rellenar. Mientras
   * falte una variable el botón no deja enviar: el motor las exige todas, así
   * que permitirlo sólo convertiría un aviso inmediato en una ejecución fallida.
   */
  await expect(consola.getByText(/Falta rellenar: name/)).toBeVisible();
  await expect(consola.getByRole('button', { name: 'Locutar' })).toBeDisabled();
  await capturar(page, '03-falta-una-variable.png');

  await consola.getByRole('textbox', { name: 'name' }).fill('Ana');
  // La vista previa compone la frase con lo escrito dentro: la plantilla cruda
  // obligaría a componerla mentalmente antes de gastar una locución.
  await expect(consola.locator('.worker-audio-preview')).toHaveText(
    'Bienvenido, Ana. Estamos listos para comenzar.',
  );
  await expect(consola.getByRole('button', { name: 'Locutar' })).toBeEnabled();
  await capturar(page, '04-plantilla-lista.png');
});

test('el desenlace se dice con todas las letras y el audio se puede oír', async ({ page }) => {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const consola = await abrirConsola(page);

  await consola.locator('.worker-fixtures select').selectOption('bienvenida-con-nombre');
  await consola.getByRole('button', { name: 'Locutar' }).click();

  await expect(consola.getByText('En cola')).toBeVisible({ timeout: 20_000 });
  await capturar(page, '05-en-cola.png');

  await expect(consola.getByText('Completado con advertencias')).toBeVisible({ timeout: 30_000 });
  /*
   * `FALLBACK` es el final que más fácil se confunde con un éxito: hay audio y
   * suena. Por eso la vista dice que lo que sonó es el RESPALDO y por qué, en
   * vez de dejar que el reproductor lo insinúe.
   */
  await expect(consola.getByText('Se sirvió el respaldo')).toBeVisible();
  await expect(consola.getByText(/cupo de locuciones de hoy/i)).toBeVisible();

  const audio = consola.locator('.worker-audio-player audio');
  await expect(audio).toBeVisible({ timeout: 30_000 });
  // Blob local y no un `src` al motor: cargar un medio es una navegación del
  // navegador y ahí no viaja el `Authorization`.
  await expect(audio).toHaveAttribute('src', /^blob:/);
  await capturar(page, '06-resultado-respaldo.png');
});

test('la misma pantalla en tema oscuro', async ({ page }) => {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.localStorage.setItem('atlas.theme', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const consola = await abrirConsola(page);
  await consola.locator('.worker-fixtures select').selectOption('bienvenida-con-nombre');
  await consola.getByRole('button', { name: 'Locutar' }).click();
  await expect(consola.locator('.worker-audio-player audio')).toBeVisible({ timeout: 30_000 });
  await capturar(page, '07-resultado-oscuro.png');
});
