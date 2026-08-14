import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';

/**
 * QA Lab contra el motor REAL: la corrida asíncrona, la semilla catalogada y el reparto
 * por desenlace (§10.4).
 *
 * Esto es lo que un simulado no puede probar. La corrida vive DETRÁS de la respuesta: el
 * `POST` devuelve 202 con la corrida en `RUNNING` y el lote sigue ejecutándose en el motor
 * mucho después, porque toda petición HTTP muere a los 15 s (`REQUEST_TIMEOUT_MS`) y
 * doscientos casos no caben ahí —«Request exceeded 15000 ms» era exactamente eso—. Contra
 * un motor fingido, cualquier implementación pasa: el simulado responde lo que se le pida
 * y al instante. Aquí la única forma de terminar en verde es que el portal sondee de
 * verdad una corrida que de verdad tarda.
 *
 * Deja la evidencia en `docs/visual-evidence/qa-lab/`.
 *
 * ```bash
 * PW_BASE_URL=http://localhost:5180 PW_TENANT_ID=1 \
 *   PW_USER=<correo> PW_PASSWORD=<clave> PW_PIN_INBOX_PORT=5199 \
 *   yarn playwright test e2e/portal-real-qa-lab.spec.ts
 * ```
 */
const EVIDENCIA = 'docs/visual-evidence/qa-lab';

/** Una corrida de verdad tarda minutos: el reloj de la prueba tiene que darle sitio. */
const RELOJ_CORRIDA = 8 * 60_000;

/** Cuántos casos lleva ejecutados, leídos del propio panel de avance. */
async function casosEjecutados(page: import('@playwright/test').Page): Promise<number> {
  const texto =
    (await page.locator('.field-hint', { hasText: 'casos ejecutados' }).innerText()) ?? '';
  return Number(/(\d+)\s+de\s+\d+\s+casos ejecutados/.exec(texto)?.[1] ?? '0');
}

test.skip(!HAY_CREDENCIALES, 'Sin PW_USER/PW_PASSWORD no se puede entrar al portal real.');
test.describe.configure({ mode: 'serial' });

test('una corrida larga sobrevive al techo de 15 s de la petición', async ({ page }) => {
  test.setTimeout(RELOJ_CORRIDA + 120_000);
  await mkdir(EVIDENCIA, { recursive: true });

  await entrar(page);
  await page.goto('/qa-lab', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'QA Lab', exact: true })).toBeVisible();

  /*
   * Elegir artefacto y versión, en ese orden: el selector de versión está desactivado
   * hasta que hay artefacto. La versión se descubre navegando en vez de fijar un `id`:
   * contra la base real un identificador escrito a mano casi nunca existe, y la prueba
   * acabaría midiendo una pantalla de «no encontrado».
   */
  // Anclado al principio: «Artefacto» a secas también casa con «Versión del artefacto», y
  // el nombre accesible arrastra además el texto de la opción de carga.
  const artefacto = page.getByLabel(/^Artefacto/);
  await expect(artefacto).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => artefacto.locator('option').count(), { timeout: 30_000 })
    .toBeGreaterThan(1);
  await artefacto.selectOption({ index: 1 });

  const version = page.getByLabel(/^Versión del artefacto/);
  await expect
    .poll(async () => version.locator('option').count(), { timeout: 30_000 })
    .toBeGreaterThan(1);
  await version.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Usar esta versión' }).click();

  const semilla = page.getByLabel('Semilla');
  await expect(semilla).toBeVisible({ timeout: 30_000 });

  // La semilla es un CATÁLOGO, no un campo libre: se elige una entrada con nombre.
  expect(await semilla.evaluate((nodo) => nodo.tagName)).toBe('SELECT');
  await semilla.selectOption('qa-base');

  await page.screenshot({ path: `${EVIDENCIA}/01-configuracion-semilla-catalogada.png` });

  /*
   * Un lote que TARDA. Es el fondo del asunto: con 5000 casos y cada uno ejecutado dos
   * veces, la tanda pasa holgadamente de los 15 s en que el motor corta cualquier petición
   * HTTP. Con 200 casos sobre un grafo rápido la corrida termina en menos de un segundo y
   * la pantalla se vería igual estuviera arreglado o no.
   */
  await page.getByLabel('Número de casos').fill('5000');
  await page.getByLabel(/^Comprobar determinismo/).check();
  // De uno en uno. Con la concurrencia de serie el motor despacha los 5000 en menos de diez
  // segundos y la corrida volvería a caber dentro del plazo que se quiere desbordar.
  await page.getByLabel('Concurrencia').fill('1');

  // Reparto por desenlace. Se espera a que el motor conteste con los desenlaces de ESTA
  // versión: comprobar la visibilidad sin esperar medía el instante anterior a la
  // respuesta y se saltaba el reparto en silencio.
  const pesos = page.locator('.outcome-weights input[type="number"]');
  await expect(pesos.first()).toBeVisible({ timeout: 30_000 });
  const cuantos = Math.min(await pesos.count(), 3);
  for (let indice = 0; indice < cuantos; indice += 1) {
    await pesos.nth(indice).fill(String([50, 30, 20][indice] ?? 10));
  }
  await page
    .locator('.outcome-weights')
    .screenshot({ path: `${EVIDENCIA}/02-reparto-por-desenlace.png` });

  const lanzar = page.getByRole('button', { name: /^Generar \d+ casos/ });
  await expect(lanzar).toBeEnabled();
  const arranque = Date.now();
  await lanzar.click();

  // Aquí está el arreglo. El `POST` responde en un instante y la corrida sigue viva: si el
  // portal esperase la respuesta, este panel no existiría y en su lugar habría un error de
  // tiempo agotado.
  const enMarcha = page.getByText('Corrida en marcha');
  await expect(enMarcha).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('progressbar')).toBeVisible();

  /*
   * El corazón de la prueba: la corrida SIGUE VIVA pasado el techo de 15 s.
   *
   * Antes, a esta altura la petición ya había muerto con «Request exceeded 15000 ms» y en
   * pantalla había un error rojo. Que aquí siga habiendo un panel de avance —y que el
   * contador haya crecido— sólo puede pasar si la ejecución vive fuera de la petición.
   */
  const avanceTemprano = await casosEjecutados(page);
  await page.waitForTimeout(20_000);
  await expect(enMarcha, 'la corrida murió antes de cruzar el techo de 15 s').toBeVisible();
  await expect(page.locator('.alert-error')).toHaveCount(0);
  const avanceTardio = await casosEjecutados(page);
  expect(avanceTardio, 'el contador no avanzó: la tanda está parada').toBeGreaterThan(
    avanceTemprano,
  );
  expect(Date.now() - arranque).toBeGreaterThan(15_000);
  // Encuadrando el panel: una captura del formulario no enseña lo que se quiere demostrar.
  await enMarcha.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${EVIDENCIA}/03-corrida-en-marcha.png` });

  // Y termina. Que el panel de en marcha desaparezca es la prueba de que la corrida cerró:
  // el portal deja de sondear sólo con COMPLETED o FAILED.
  await expect(enMarcha).toBeHidden({ timeout: RELOJ_CORRIDA });

  const ejecutados = page.locator('.metric-card', { hasText: 'Casos ejecutados' });
  await expect(ejecutados).toBeVisible();
  // Cero casos ejecutados sería una corrida que murió sin hacer nada, que es justo el
  // fallo anterior con otra cara.
  await expect(ejecutados).not.toContainText(/\b0\b/);
  await page.screenshot({ path: `${EVIDENCIA}/04-corrida-terminada.png`, fullPage: true });

  // El historial la enseña cerrada, no en marcha.
  await expect(page.locator('.data-table tbody tr').first()).toContainText('Terminada');
  await page
    .locator('.data-table')
    .first()
    .screenshot({ path: `${EVIDENCIA}/05-historial.png` });
});
