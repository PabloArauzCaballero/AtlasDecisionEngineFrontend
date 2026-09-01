import { expect, test } from '@playwright/test';
import { mockPdfBackend } from './support/pdf-backend';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * La pestaña del generador documental dentro de «Procesamiento».
 *
 * Los dos simulados se instalan juntos porque la pantalla los necesita a los
 * dos: el de workers para las cuatro pestañas que ya existían y el de `/pdf/*`
 * para la quinta. Montar sólo el segundo mediría una página a medio cargar.
 *
 * Lo que se comprueba no es que «se renderiza algo», sino las tres cosas que
 * podían salir mal al añadirla: que la pestaña aparece junto a las otras cuatro,
 * que su panel NO es el de los workers —no comparte catálogo ni métricas— y que
 * el formulario se construye a partir del contrato que publica el motor.
 */

test.beforeEach(async ({ page }) => {
  await mockWorkersBackend(page);
  await mockPdfBackend(page);
});

test('el quinto destino aparece junto a los cuatro workers', async ({ page }) => {
  await page.goto('/workers');

  const cajon = page.locator('.sidebar');
  await expect(cajon.getByRole('link', { name: 'Análisis semántico' })).toBeVisible();
  await expect(cajon.getByRole('link', { name: 'Extractos bancarios' })).toBeVisible();
  await expect(cajon.getByRole('link', { name: 'Identidad', exact: true })).toBeVisible();
  await expect(cajon.getByRole('link', { name: 'Locución' })).toBeVisible();
  await expect(cajon.getByRole('link', { name: 'Documentos PDF' })).toBeVisible();
});

test('su ruta propia entra directamente en ella', async ({ page }) => {
  await page.goto('/workers/pdf-generator');

  // El título de la página es el del worker elegido, no un genérico: es lo que
  // el enlace compartido tiene que anunciar.
  await expect(page.getByRole('heading', { level: 1, name: 'Documentos PDF' })).toBeVisible();
  await expect(
    page.locator('.sidebar').getByRole('link', { name: 'Documentos PDF' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('el panel publica la salud del generador, no la de un worker', async ({ page }) => {
  await page.goto('/workers/pdf-generator');

  const panel = page.getByRole('region', { name: 'Estado del generador' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('playwright-chromium')).toBeVisible();

  // El aviso de tipografía es el que más importa de la sonda: sin fuente
  // embebida el documento depende de la del sistema y deja de ser reproducible.
  // Se publica como AVISO y no como fallo, y la pantalla tiene que distinguirlo.
  await expect(panel.getByText(/ninguna fuente embebida/)).toBeVisible();
  await expect(panel.getByText('Operativo')).toBeVisible();
});

test('el formulario se construye con los campos que publica el motor', async ({ page }) => {
  await page.goto('/workers/pdf-generator?vista=consola');

  const consola = page.locator('[data-tutorial-id="workers-console"]').first();

  // Ni un control está escrito a mano: todos salen de `/pdf/templates/:id/schema`.
  await expect(consola.getByLabel(/^title/)).toBeVisible();
  await expect(consola.getByLabel(/^score/)).toHaveAttribute('type', 'number');
  await expect(consola.getByLabel(/^revisado/)).toHaveAttribute('type', 'checkbox');

  // El enum llega con sus valores; sin ellos sería un campo de texto donde
  // cualquier errata acabaría en un 422 del motor.
  const decision = consola.getByLabel(/^decision/);
  await expect(decision).toBeVisible();
  await expect(decision.locator('option')).toHaveText([
    '— sin elegir —',
    'APPROVED',
    'REJECTED',
    'REVIEW',
  ]);

  // El formulario se siembra con el ejemplo del propio template: un formulario
  // vacío con doce campos obliga a adivinar la forma de cada uno.
  await expect(consola.getByLabel(/^title/)).toHaveValue('Resultado del análisis');
});

test('genera el documento y lo descarga', async ({ page }) => {
  await page.goto('/workers/pdf-generator?vista=consola');

  const consola = page.locator('[data-tutorial-id="workers-console"]').first();
  const descarga = page.waitForEvent('download');
  await consola.getByRole('button', { name: 'Generar y descargar' }).click();

  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toBe('informe.pdf');
});

test('sólo ofrece artefactos que encajan, y dice cuántos ocultó', async ({ page }) => {
  await page.goto('/workers/pdf-generator?vista=consola');

  const vinculo = page.getByRole('region', { name: 'Artefacto de origen' });
  await expect(vinculo).toBeVisible();

  // Sólo el compatible llega al desplegable. Ofrecer uno que el motor va a
  // rechazar es invitar a preparar una generación que no se puede completar.
  const opciones = vinculo.locator('#doc-artifact option');
  await expect(opciones).toHaveCount(1);
  await expect(opciones.first()).toContainText('informe-generico');

  // Pero el filtro NO es silencioso, y no se queda en el recuento: dice CUÁL se
  // ocultó y POR QUÉ. Un número a secas obliga a adivinar si hay que corregir el
  // artefacto o elegir otro documento, que se arreglan en sitios distintos.
  const ocultos = vinculo.locator('.doc-binding__ocultos');
  await expect(ocultos).toContainText('1 artefacto(s) no se ofrecen');
  await ocultos.locator('summary').click();
  await expect(ocultos).toContainText('riesgo-credito');
  await expect(ocultos).toContainText('el artefacto no publica este campo');
  await expect(ocultos.locator('code', { hasText: 'decision' })).toBeVisible();

  // Y con uno compatible seleccionado, rellenar SÍ está disponible.
  await expect(vinculo.getByText('Compatible')).toBeVisible();
  await expect(
    vinculo.getByRole('button', { name: 'Rellenar con datos del artefacto' }),
  ).toBeEnabled();
});
