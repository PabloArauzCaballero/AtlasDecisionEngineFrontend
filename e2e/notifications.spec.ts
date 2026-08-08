import { expect, test } from '@playwright/test';
import { collectProblems } from './support/backend-mock';
import { notificationsBackend } from './support/notifications-backend';

/**
 * Lo que el portal le dice al operador, medido sobre el DOM ya pintado.
 *
 * Las pruebas de unidad fijan la cola por dentro; éstas comprueban que lo que
 * llega a la pantalla es lo que la cola decidió —que el fallo repetido sale una
 * sola vez y que una operación larga termina diciendo en qué acabó—. La
 * expulsión por prioridad no se mide aquí: exigiría cuatro avisos distintos
 * lanzados a mano, y provocarlos desde la interfaz mediría el atajo, no la vista.
 */

const ESCRITORIO = { width: 1440, height: 900 };

/** El visor de avisos: se busca por su nombre accesible, no por una clase. */
const AVISOS = '[aria-label="Notificaciones"] > li';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(ESCRITORIO);
  await notificationsBackend(page);
});

/** Abre la sección plegada donde viven las notas y devuelve su panel. */
async function abrirNotas(page: import('@playwright/test').Page) {
  await page.goto('/graph-editor');
  await page.waitForSelector('.graph-workbench', { timeout: 30_000 });
  // Las notas pertenecen a una versión: sin elegirla, el panel ni se pinta.
  await page.locator('#graph-version-id').selectOption('ver-demo');
  await page.getByRole('button', { name: /Análisis del flujo/ }).click();
  const notas = page.locator('.graph-notes');
  await expect(notas).toBeVisible();
  return notas;
}

test('el mismo fallo repetido sale una vez, con su contador', async ({ page }) => {
  const notas = await abrirNotas(page);
  await notas.locator('textarea').fill('Primera versión de las notas.');
  const guardar = page.getByRole('button', { name: 'Guardar notas' });

  // Tres intentos contra un motor que contesta siempre lo mismo. Se espera la
  // respuesta de cada uno: si no, los tres clics se solapan y no se mide nada.
  for (let intento = 0; intento < 3; intento += 1) {
    await expect(guardar).toBeEnabled();
    await Promise.all([page.waitForResponse((r) => r.url().includes('/notes')), guardar.click()]);
  }

  /*
   * Una sola tarjeta. Antes salían tres idénticas y, por ser las más nuevas,
   * desalojaban de la pila a cualquier otro aviso que hubiera debajo.
   */
  await expect(page.locator(AVISOS)).toHaveCount(1);

  /*
   * Y el contador se LEE. Comprobar el texto no basta: la insignia usaba
   * `background: currentColor` junto a `color: var(--surface)`, y currentColor se
   * resuelve contra el color del propio elemento —blanco sobre blanco—. El «×3»
   * estaba en el DOM, invisible, y una prueba de texto lo daba por bueno.
   */
  const insignia = page.locator('.toast-repeat');
  await expect(insignia).toHaveText('×3');
  const pintura = await insignia.evaluate((el) => {
    const estilo = getComputedStyle(el);
    return { fondo: estilo.backgroundColor, letra: estilo.color };
  });
  expect(pintura.fondo, 'la insignia se pinta del color de su tono').not.toBe(pintura.letra);
});

test('el fallo de guardar notas se cuenta una vez, no dos', async ({ page }) => {
  const notas = await abrirNotas(page);
  await notas.locator('textarea').fill('Notas que no se van a poder guardar.');

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/notes')),
    page.getByRole('button', { name: 'Guardar notas' }).click(),
  ]);

  /*
   * La vista tenía su propio `onError` sin declarar `meta.handled`, así que el
   * aviso global y el suyo contaban el mismo fallo: dos tarjetas, y la propia
   * era la peor —sin el motivo del backend ni la referencia de la petición—.
   */
  await expect(page.locator(AVISOS)).toHaveCount(1);
  await expect(page.locator(AVISOS).first()).toContainText('El motor no está disponible');
});

test('una ejecución larga acaba diciendo en qué acabó', async ({ page }) => {
  const problemas = collectProblems(page);
  await page.goto('/live-execution');
  await page.waitForSelector('.simulator-layout', { timeout: 30_000 });

  // Los dos selectores del par artefacto/versión comparten nombre accesible con
  // su marcador de posición, así que se toman por posición dentro del control.
  const picker = page.locator('.artifact-version-picker select');
  await picker.first().selectOption('BNPL_CREDIT_DECISION');
  await picker.nth(1).selectOption('ver-demo');

  const lanzar = page.getByRole('button', { name: /Iniciar ejecución en vivo/ });
  await expect(lanzar).toBeEnabled();
  await lanzar.click();

  /*
   * El desenlace llega a la MISMA tarjeta que anunció el arranque. Antes la
   * ejecución terminaba en silencio —rellenaba un panel y ya está—, así que
   * quien hubiera bajado la página no se enteraba de que había acabado.
   */
  const aviso = page.locator(AVISOS).filter({ hasText: 'Ejecución completada' });
  await expect(aviso).toHaveCount(1);
  await expect(aviso).toContainText('2 nodos');
  // Y no deja además la tarjeta de «en curso» colgada girando para siempre.
  await expect(page.locator(AVISOS).filter({ hasText: 'en curso' })).toHaveCount(0);

  expect(problemas, problemas.join('\n')).toEqual([]);
});
