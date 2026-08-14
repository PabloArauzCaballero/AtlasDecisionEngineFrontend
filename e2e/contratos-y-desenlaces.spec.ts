import { expect, test, type Page } from '@playwright/test';
import { mockDesenlacesBackend } from './support/desenlaces-backend';

/**
 * Las cuatro pantallas que cambiaron, medidas contra la forma REAL del motor.
 *
 * Cada prueba afirma lo que había que arreglar —los valores permitidos enumerados, los
 * tres desenlaces del campo calculado con su etiqueta propia, un caso por resultado
 * posible— y deja además la captura en `docs/visual-evidence/desenlaces/`. Las dos cosas
 * juntas a propósito: una captura sin aserción no detecta nada, y una aserción sin captura
 * no deja ver si el resultado se lee.
 */

const OUT = 'docs/visual-evidence/desenlaces';

/**
 * `animations: 'disabled'` adelanta las animaciones de entrada a su último fotograma. Sin
 * eso la captura las reinicia y, al declararse con `both`, las congela en opacidad cero:
 * los paneles salían en blanco y parecían un fallo de la interfaz.
 */
function capturar(page: Page, nombre: string) {
  return page.screenshot({ path: `${OUT}/${nombre}`, fullPage: true, animations: 'disabled' });
}

test.beforeEach(async ({ page }) => {
  await mockDesenlacesBackend(page);
});

test('el contrato de una variable enumera sus valores permitidos', async ({ page }) => {
  await page.goto('/variables/79', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.variable-version-list')).toBeVisible({ timeout: 30_000 });

  // Lo que faltaba: CUÁLES son los cuatro valores, no que sean cuatro.
  for (const valor of ['TRUSTED', 'NEUTRAL', 'SUSPICIOUS', 'BLOCKLISTED']) {
    await expect(page.locator('.allowed-values code', { hasText: valor })).toBeVisible();
  }
  await expect(page.getByText(/VALUE_NOT_ALLOWED/)).toBeVisible();
  // De dónde llega el valor y quién manda: el motor lo devolvía y no se pintaba.
  await expect(page.getByText('REQUEST_PAYLOAD')).toBeVisible();
  await expect(page.locator('.source-authoritative')).toBeVisible();

  await capturar(page, 'variable-contrato-detallado.png');
});

test('el campo calculado separa dentro y fuera de rango, y deja copiar el código', async ({
  page,
}) => {
  await page.goto('/calculated-fields/80', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.result-contract')).toBeVisible({ timeout: 30_000 });

  // Cada desenlace con su etiqueta: antes caían descolocados en una rejilla de tres.
  for (const titulo of [
    'Dentro de rango',
    'Fuera de rango',
    'Si falta un dato de entrada',
    'División entre cero',
  ]) {
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  }
  // Qué IMPLICA, no el nombre de la política.
  await expect(page.getByText(/El propio 0 SÍ se acepta/)).toBeVisible();
  await expect(page.getByText(/entrega el valor por defecto/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Copiar código/ })).toBeVisible();

  await capturar(page, 'campo-calculado-contrato.png');
});

test('el simulador genera un caso por cada resultado posible', async ({ page }) => {
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.sample-bar')).toBeVisible({ timeout: 30_000 });

  // La opción por omisión ya no es «válidos»: es la que prueba las decisiones.
  await expect(page.locator('.sample-bar-kind select')).toHaveValue('OUTCOMES');
  await page.locator('.simulator-form select').first().selectOption('BNPL_CREDIT_DECISION');
  await page.getByRole('button', { name: /Generar valores/ }).click();

  // Un chip por desenlace, rotulado con el desenlace y no con «Caso 3».
  await expect(page.getByRole('button', { name: /Caso 1 · Resultado: rechazada/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: /Caso 3 · Resultado: aprobada/ })).toBeVisible();
  // Y la rama que la entrada no puede forzar se declara, en vez de presumir cobertura.
  await expect(page.getByText(/no están garantizadas/)).toBeVisible();

  await capturar(page, 'simulador-por-desenlace.png');
});

test('el QA Lab reparte los casos válidos entre los desenlaces del algoritmo', async ({ page }) => {
  await page.goto('/qa-lab', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.artifact-version-picker')).toBeVisible({ timeout: 30_000 });

  const selects = page.locator('.artifact-version-picker select');
  await selects.first().selectOption('BNPL_CREDIT_DECISION');
  await expect(selects.nth(1)).toBeEnabled({ timeout: 20_000 });
  await selects.nth(1).selectOption('274');
  await page.getByRole('button', { name: 'Usar esta versión' }).click();

  // La cobertura por desenlace viene activada: es lo que responde «¿probé cada decisión?».
  const cobertura = page.getByRole('checkbox', {
    name: /Añadir un caso por cada resultado posible/,
  });
  await expect(cobertura).toBeChecked({ timeout: 30_000 });
  // Y el reparto se elige sobre los desenlaces que publica el motor, no tecleando claves.
  await expect(page.locator('.outcome-weights')).toBeVisible({ timeout: 20_000 });
  for (const rotulo of ['Resultado: aprobada', 'Resultado: rechazada']) {
    await expect(page.locator('.outcome-weights').getByText(rotulo)).toBeVisible();
  }
  await expect(
    page.getByRole('button', { name: /Generar 200 casos \+ los desenlaces/ }),
  ).toBeVisible();

  await capturar(page, 'qa-lab-desenlaces.png');
});
