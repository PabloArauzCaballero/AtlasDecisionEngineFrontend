import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';

/**
 * La sincronización QA Lab → monitoreo del modelo, contra el motor REAL.
 *
 * Somete una versión desplegada a una SERIE de estrés —tres corridas de tamaño creciente y
 * misma configuración— y comprueba que el carril sintético del monitoreo la lee: casos
 * ejecutados, coste por caso y cuánto se encarece bajo carga.
 *
 * Contra un simulado esto no probaría nada: el simulado devuelve las cifras que se le piden y
 * al instante, así que el panel se vería idéntico estuviera bien o mal. Aquí los milisegundos
 * los pone el motor ejecutando decisiones de verdad, y la comparación entre corridas sólo sale
 * si el motor archivó la carga de cada una —que es el dato que faltaba y por el que dos
 * corridas no eran comparables—.
 *
 * Deja la evidencia en `docs/visual-evidence/qa-monitoreo/`.
 *
 * ```bash
 * PW_BASE_URL=http://localhost:5180 PW_TENANT_ID=1 \
 *   PW_USER=<correo> PW_PASSWORD=<clave> PW_PIN_INBOX_PORT=5199 \
 *   yarn playwright test e2e/portal-real-qa-monitoreo.spec.ts
 * ```
 */
const EVIDENCIA = 'docs/visual-evidence/qa-monitoreo';

/**
 * La serie. Tamaño creciente y MISMA configuración, que es la única forma de que el coste por
 * caso signifique degradación del motor y no diferencia de configuración.
 *
 * Concurrencia 1 a propósito: con la de serie el motor despacha ocho a la vez y las tres
 * corridas terminan tan rápido que sus duraciones son ruido de máquina —la serie saldría con
 * un factor aleatorio alrededor de 1 y la prueba pasaría estuviera bien o mal—.
 */
const SERIE = [300, 1200, 3000];
const CONCURRENCIA = 1;

/** Una corrida larga tarda; el reloj de la prueba tiene que darle sitio a las tres. */
const RELOJ_SERIE = 12 * 60_000;

test.skip(!HAY_CREDENCIALES, 'Sin PW_USER/PW_PASSWORD no se puede entrar al portal real.');
test.describe.configure({ mode: 'serial' });

test('una serie de estrés del QA Lab se lee en el monitoreo del modelo', async ({ page }) => {
  test.setTimeout(RELOJ_SERIE + 180_000);
  await mkdir(EVIDENCIA, { recursive: true });

  await entrar(page);

  const versionId = await prepararQaLab(page);
  for (const casos of SERIE) await lanzarCorrida(page, casos);
  await page.screenshot({ path: `${EVIDENCIA}/01-serie-en-qa-lab.png`, fullPage: true });

  /*
   * Y ahora la otra pantalla. El identificador de versión se ARRASTRA desde el QA Lab en vez de
   * elegir «la primera» otra vez: si las dos vistas ordenaran distinto, la prueba mediría el
   * carril de una versión que nadie sometió a estrés y saldría en verde por vacía.
   */
  await page.goto('/model-monitoring', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Monitoreo del modelo');
  await page.getByLabel(/^Artefacto/).selectOption({ index: 1 });
  const version = page.getByLabel(/^Versión a monitorear/);
  await expect
    .poll(async () => version.locator('option').count(), { timeout: 30_000 })
    .toBeGreaterThan(1);
  await version.selectOption(versionId);

  const carril = page.locator('.panel').filter({ hasText: 'Sincronización con QA Lab' });
  await expect(carril).toBeVisible({ timeout: 30_000 });

  /*
   * Sin pulsar «Medir»: el carril se sincroniza con la versión ELEGIDA. Es lo único medible de
   * una versión recién desplegada, que todavía no tiene ni un desenlace observado.
   *
   * Se comprueba un SUELO y no una cuenta exacta: contra la base real la versión puede arrastrar
   * corridas de otros días, y exigir «exactamente tres» convertiría un historial normal en un
   * fallo de la prueba.
   */
  await expect
    .poll(async () => carril.locator('tbody tr').count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(SERIE.length);

  // Las tres recién lanzadas van arriba —la tabla ordena de la más nueva a la más vieja— y
  // ejecutaron casos DE VERDAD: cada fila trae su coste por caso medido, no un guion. Un «—»
  // aquí significaría que el motor cerró la corrida sin ejecutar nada.
  for (let fila = 0; fila < SERIE.length; fila += 1) {
    const recien = carril.locator('tbody tr').nth(fila);
    await expect(recien).toContainText('Terminada');
    await expect(recien).toContainText(/\d+([.,]\d+)? ms/);
    await expect(recien).toContainText(/casos\/s/);
    // La concurrencia archivada, que es lo que hace comparables estas tres filas entre sí.
    await expect(recien).toContainText(String(CONCURRENCIA));
  }

  // El total es la suma de la serie más los casos por desenlace que el grafo añade a cada
  // corrida, así que se comprueba el suelo y no una cifra exacta.
  const casosTotales = await leerNumero(carril, 'Casos ejecutados');
  expect(casosTotales).toBeGreaterThanOrEqual(SERIE.reduce((suma, casos) => suma + casos, 0));

  /*
   * Y la lectura que da nombre a todo esto: cuánto se encarece un caso al multiplicar la carga.
   * Puede salir por debajo de 1 —el motor calienta cachés y la corrida grande sale más barata
   * por caso— y sigue siendo una medición válida. Lo que NO puede es faltar: con tres corridas
   * comparables el panel tiene que dar el factor, y si da el aviso de «no comparables» es que
   * la carga no se archivó.
   */
  await expect(carril).not.toContainText('Hacen falta dos corridas');
  await expect(carril).toContainText(/×\d+[.,]\d+/);

  // Y lo que impide la lectura peligrosa: miles de decisiones sintéticas en la misma pantalla
  // donde se responde por la tasa de malos de la cartera.
  await expect(carril).toContainText('No entra en ninguna tasa de esta pantalla');

  await carril.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${EVIDENCIA}/02-carril-sintetico.png`, fullPage: true });
});

/** Elige artefacto y versión en el QA Lab, y devuelve el identificador de versión elegido. */
async function prepararQaLab(page: Page): Promise<string> {
  await page.goto('/qa-lab', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'QA Lab', exact: true })).toBeVisible();

  // La versión se descubre navegando: contra la base real un identificador escrito a mano casi
  // nunca existe, y la prueba acabaría midiendo una pantalla de «no encontrado».
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
  const versionId = await version.inputValue();
  await page.getByRole('button', { name: 'Usar esta versión' }).click();

  await expect(page.getByLabel('Concurrencia')).toBeVisible({ timeout: 30_000 });
  return versionId;
}

/** Lanza una corrida y espera a que el motor la cierre. */
async function lanzarCorrida(page: Page, casos: number): Promise<void> {
  await page.getByLabel('Número de casos').fill(String(casos));
  await page.getByLabel('Concurrencia').fill(String(CONCURRENCIA));

  const lanzar = page.getByRole('button', { name: /^Generar \d+ casos/ });
  await expect(lanzar).toBeEnabled({ timeout: 30_000 });
  await lanzar.click();

  // La corrida vive DETRÁS de la respuesta: el `POST` contesta al instante con la corrida en
  // marcha y el lote sigue en el motor. Que el panel de avance aparezca y luego desaparezca es
  // la señal de que se cerró; el portal deja de sondear sólo con COMPLETED o FAILED.
  const enMarcha = page.getByText('Corrida en marcha');
  await expect(enMarcha).toBeVisible({ timeout: 60_000 });
  await expect(enMarcha).toBeHidden({ timeout: RELOJ_SERIE });
  await expect(page.locator('.alert-error')).toHaveCount(0);
}

/** El valor de una tarjeta de métrica, sin los separadores de millar. */
async function leerNumero(carril: ReturnType<Page['locator']>, etiqueta: string): Promise<number> {
  const texto = await carril.locator('.metric-card', { hasText: etiqueta }).innerText();
  return Number(/([\d.,]+)/.exec(texto.replace(etiqueta, ''))?.[1].replace(/[.,]/g, '') ?? '0');
}
