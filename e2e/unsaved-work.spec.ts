import { expect, test } from '@playwright/test';
import { mockWorkersBackend } from './support/workers-backend';

const TEXTO = 'PAGO SERVICIO INTERNET QUE NO QUIERO PERDER';

test('la guarda pregunta antes de tirar trabajo, y no molesta cuando no lo hay', async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  await mockWorkersBackend(page);
  await page.goto('/workers/semantic-analysis', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const cajon = page.locator('.sidebar');
  await expect(cajon).toBeVisible({ timeout: 60_000 });

  const consola = page.locator('.worker-console');
  await page.getByRole('tab', { name: 'Consola' }).click();
  await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 60_000 });

  // 1) Sin trabajo empezado, cambiar de pestaña no pregunta nada.
  await page.getByRole('tab', { name: 'Panel de control' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Consola' }).click();

  await consola.getByRole('radio', { name: /Escribir un texto/ }).check();
  await consola.locator('textarea').fill(TEXTO);

  // 2) Con trabajo escrito, cambiar de pestaña SIGUE sin preguntar: no se pierde.
  await page.getByRole('tab', { name: 'Panel de control' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Consola' }).click();
  await expect(consola.locator('textarea')).toHaveValue(TEXTO);

  // 3) Salir de la ruta SÍ pregunta, y quedarse conserva el texto.
  await cajon.getByRole('link', { name: /^Variables$/i }).click();
  const aviso = page.getByRole('dialog');
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText('Análisis Semántico');
  await aviso.getByRole('button', { name: 'Quedarme aquí' }).click();
  await expect(aviso).toHaveCount(0);
  await expect(page).toHaveURL(/\/workers/);
  await expect(consola.locator('textarea')).toHaveValue(TEXTO);

  // 4) Y elegir salir navega de verdad.
  await cajon.getByRole('link', { name: /^Variables$/i }).click();
  // Es un enlace, no un botón: navega de verdad y se puede abrir en otra pestaña.
  await page.getByRole('dialog').getByRole('link', { name: 'Salir y perderlo' }).click();
  await expect(page).toHaveURL(/\/variables/, { timeout: 60_000 });
});
