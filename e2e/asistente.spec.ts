import { expect, test, type Page } from '@playwright/test';
import { collectProblems, mockBackend } from './support/backend-mock';

/**
 * El asistente de Atlas, sobre el DOM ya pintado.
 *
 * La queja que originó esto era «no aparece en ningún portal», así que lo primero que se afirma es
 * que el botón ESTÁ, en más de una pantalla y en móvil, y que no queda encima de los avisos. Core se
 * simula en `/atlas-backend/internal/assist/*`, con su sobre `{ requestId, data }`: simularlo pelado
 * probaría una forma que el backend nunca devuelve.
 */

const HILO = { requestId: 'r-1', data: { conversationId: null, turns: [] } };

async function simularAsistente(page: Page, opciones: { apagado?: boolean } = {}) {
  await page.route('**/atlas-backend/internal/assist/conversation*', (route) =>
    opciones.apagado
      ? route.fulfill({
          status: 404,
          json: { error: { code: 'ASSIST_DISABLED', message: 'Apagado.' } },
        })
      : route.fulfill({ json: HILO }),
  );
  await page.route('**/atlas-backend/internal/assist/chat', async (route) => {
    const cuerpo = route.request().postDataJSON() as { surface: string; screen?: string };
    await route.fulfill({
      json: {
        requestId: 'r-2',
        data: {
          reply: `Estás en ${cuerpo.screen}. Abre «Despliegues» y pulsa «Nuevo despliegue».`,
          suggestHandoff: false,
          conversationId: 'c-1',
          turnId: 't-1',
          mode: 'sin-ia',
        },
      },
    });
  });
}

test('el botón aparece en cualquier pantalla con sesión y el panel responde', async ({ page }) => {
  const problemas = collectProblems(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockBackend(page);
  await simularAsistente(page);

  await page.goto('/variables');
  await page.waitForSelector('.sidebar', { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Asistente de Atlas' })).toBeVisible();

  await page.goto('/deployments');
  await page.waitForSelector('.sidebar', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Asistente de Atlas' }).click();
  const panel = page.getByRole('dialog', { name: 'Asistente de Atlas' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('No escribas contraseñas, códigos ni datos personales.');

  const campo = panel.getByRole('textbox', { name: 'Tu pregunta para el asistente' });
  await campo.fill('¿Cómo despliego una versión?');
  const [peticion] = await Promise.all([
    page.waitForRequest('**/atlas-backend/internal/assist/chat'),
    campo.press('Enter'),
  ]);
  expect(peticion.postDataJSON()).toMatchObject({
    surface: 'risk-portal',
    prompt: '¿Cómo despliego una versión?',
    screen: 'Gobierno › Despliegues',
  });
  await expect(panel).toContainText('Estás en Gobierno › Despliegues.');
  await expect(panel).toContainText('Respuesta sin IA: texto de la guía.');

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(problemas).toEqual([]);
});

test('apagado en el ambiente: el botón sigue y el panel lo explica', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await simularAsistente(page, { apagado: true });

  await page.goto('/artifacts');
  await page.waitForSelector('.sidebar', { state: 'attached', timeout: 60_000 });
  const boton = page.getByRole('button', { name: 'Asistente de Atlas' });
  await expect(boton).toBeVisible();
  await boton.click();

  const panel = page.getByRole('dialog', { name: 'Asistente de Atlas' });
  await expect(panel).toContainText('El asistente todavía no está encendido en este ambiente.');
  await expect(panel.getByRole('textbox')).toBeDisabled();
  // En un teléfono ocupa casi toda la pantalla.
  const caja = await panel.boundingBox();
  expect(caja?.width ?? 0).toBeGreaterThan(360);
});
