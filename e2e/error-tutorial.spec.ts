import { expect, test, type Page } from '@playwright/test';
import { collectProblems, MOCK_SESSION } from './support/backend-mock';
import { GRAPH } from './support/graph-fixtures';

/**
 * Recorrido «error → tutorial guiado → corrección».
 *
 * Un error del motor no puede terminar en un mensaje técnico opaco: tiene que
 * ofrecer el recorrido que enseña a corregirlo, y ese recorrido tiene que
 * abrirse de verdad sobre la pantalla en la que estás. El mapeo código→tutorial
 * tiene pruebas unitarias; lo que faltaba —y es lo que puede romperse sin que
 * nadie se entere— es que la cadena completa funcione en el navegador.
 *
 * Se comprueba además que el fallo se anuncia UNA sola vez: al escribir esta
 * prueba el mismo error salía por tres sitios a la vez (el aviso global de toda
 * mutación fallida, un aviso local con el tutorial y el diálogo del editor).
 */

/** Error de dominio real del motor: el que sale al guardar un grafo inválido. */
const DOMAIN_ERROR = {
  code: 'GRAPH_VALIDATION_FAILED',
  message: 'The graph has validation errors',
  details: { issues: [{ code: 'NODE_NO_TERMINAL_PATH', message: 'CHECK_1 no llega a un final' }] },
};

async function mockGraphEditor(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    // Guardar el grafo SIEMPRE falla: es lo que dispara la notificación con
    // acción, que es lo que esta prueba verifica.
    if (method === 'PUT' && url.includes('/graph')) {
      return route.fulfill({ status: 422, json: DOMAIN_ERROR });
    }
    if (url.includes('/graph')) return route.fulfill({ json: GRAPH });
    if (url.includes('/v1/artifact-versions/')) {
      return route.fulfill({ json: { id: '1', lockVersion: 1, status: 'DRAFT' } });
    }
    return route.fulfill({
      json: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, hasNextPage: false },
    });
  });
}

test('un error al guardar ofrece el tutorial guiado y lo abre', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = collectProblems(page);
  await mockGraphEditor(page);

  await page.goto('/graph-editor?versionId=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.graph-canvas')).toBeVisible({ timeout: 30_000 });

  await page
    .getByRole('button', { name: /Guardar/ })
    .first()
    .click();

  // 1. El fallo se anuncia UNA sola vez, en el diálogo del editor, y con la
  // explicación del catálogo en vez del mensaje técnico crudo.
  const dialog = page.locator('.modal-dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).not.toContainText('The graph has validation errors');
  await expect(page.locator('.toast-error')).toHaveCount(0);

  // 2. Ofrece el recorrido que enseña a corregirlo…
  const action = dialog.getByRole('button', { name: 'Ver tutorial guiado' });
  await expect(action).toBeVisible();

  // 3. …y al pulsarlo el recorrido se abre de verdad, con su primer paso.
  // Se busca el overlay por su clase y no por rol: el editor muestra además su
  // propio modal para el mismo fallo, y ambos son `role="dialog"`.
  await action.click();
  const overlay = page.locator('.tutorial-overlay');
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  await expect(overlay).toContainText(/paso 1 de/i);
  await expect(overlay.getByRole('button', { name: /Siguiente|Finalizar/ })).toBeVisible();

  // 4. Y se puede cerrar sin dejar la pantalla bloqueada.
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();

  expect(problems, problems.join('\n')).toEqual([]);
});
