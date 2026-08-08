import { expect, test, type Page } from '@playwright/test';
import { collectProblems, EMPTY_PAGE, MOCK_SESSION } from './support/backend-mock';
import { denseBackend } from './support/dense-backend';

/**
 * Centro de Tutoriales y motor de recorridos, en el navegador de verdad.
 *
 * Lo que las pruebas unitarias no pueden ver es justo lo que aquí se rompe: que
 * al pulsar "Comenzar" el portal NAVEGUE a la pantalla del tutorial, que el
 * elemento se resalte una vez montada esa vista (que llega después de su
 * petición al backend) y que el progreso sobreviva a una recarga.
 *
 * El progreso se guarda contra un backend simulado en memoria, no contra `[]`
 * fijo: con una respuesta constante no se podría distinguir "se guardó" de "no
 * se guardó nunca", que es la mitad de lo que se quiere comprobar.
 */

/**
 * Tarjeta de un tutorial por su TÍTULO, no por texto suelto: el nombre de un
 * recorrido aparece también dentro de otras tarjetas, en la línea de "conviene
 * hacer antes", y un filtro por texto plano las agarraría todas.
 */
function tutorialCard(page: Page, title: string) {
  return page
    .locator('.tutorial-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

/** Backend simulado con memoria para `/v1/tutorial-progress`. */
async function mockPortal(page: Page): Promise<Map<string, unknown>> {
  const saved = new Map<string, unknown>();

  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });

    if (url.includes('/v1/tutorial-progress')) {
      const id = decodeURIComponent(url.split('/v1/tutorial-progress/')[1] ?? '');
      if (method === 'PUT') {
        saved.set(id, route.request().postDataJSON());
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({
        json: [...saved.entries()].map(([tutorialId, body]) => ({
          tutorialId,
          ...(body as Record<string, unknown>),
        })),
      });
    }

    if (url.includes('/v1/environments')) {
      return route.fulfill({ json: [{ code: 'SANDBOX' }] });
    }
    return route.fulfill({ json: EMPTY_PAGE });
  });

  return saved;
}

/**
 * Igual que `mockPortal` pero con LISTADOS LLENOS.
 *
 * El motor simulado normal devuelve páginas vacías, y un recorrido de ficha
 * necesita una fila que abrir: contra una tabla vacía la prueba mediría el
 * estado vacío creyendo que mide el recorrido. `denseBackend` se registra
 * primero para que la ruta del progreso, añadida después, tenga prioridad.
 */
async function mockDensePortal(page: Page): Promise<void> {
  await denseBackend(page);
  await page.route('**/v1/tutorial-progress**', (route) => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ json: [] });
  });
}

test.describe('Centro de Tutoriales', () => {
  test('lista los recorridos, filtra y muestra el avance', async ({ page }) => {
    const problems = collectProblems(page);
    await mockPortal(page);

    await page.goto('/tutorials', { waitUntil: 'domcontentloaded' });
    // Por nivel: "Centro de Tutoriales" es también el título de una tarjeta del
    // catálogo (el recorrido que enseña a usar esta pantalla).
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Centro de Tutoriales', {
      timeout: 30_000,
    });

    // El avance general se anuncia como barra de progreso accesible.
    const bar = page.getByRole('progressbar', { name: /Avance general/ });
    await expect(bar).toHaveAttribute('aria-valuenow', '0');

    const cards = page.locator('.tutorial-card');
    const before = await cards.count();
    expect(before).toBeGreaterThan(5);

    // El buscador acota la lista de verdad.
    await page.getByRole('searchbox').fill('grafo');
    await expect(cards).not.toHaveCount(before);
    await expect(page.locator('.tutorial-card', { hasText: 'Editor de grafo' })).toBeVisible();

    // Y un filtro imposible explica cómo salir, en vez de dejar la nada.
    await page.getByRole('searchbox').fill('zzzzzz');
    await expect(page.getByText('Ningún tutorial coincide')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(cards).toHaveCount(before);

    expect(problems).toEqual([]);
  });

  test('«Comenzar» navega a la pantalla real y resalta el elemento del paso', async ({ page }) => {
    const problems = collectProblems(page);
    await mockPortal(page);

    await page.goto('/tutorials', { waitUntil: 'domcontentloaded' });
    await tutorialCard(page, 'Catálogo de Variables')
      .getByRole('button', { name: /Comenzar/ })
      .click();

    // 1. El portal cambia de pantalla solo…
    await expect(page).toHaveURL(/\/variables/, { timeout: 30_000 });
    // 2. …y el recorrido sigue vivo sobre esa vista.
    const card = page.locator('.tutorial-tooltip');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText('paso 1 de');

    // 3. El primer paso presenta la pantalla y no señala nada, así que se
    //    atenúa el fondo entero; el resalte llega en el paso que sí apunta a un
    //    elemento, y ese elemento vive en una vista que se monta DESPUÉS de su
    //    petición al backend: es justo el caso asíncrono que interesa cubrir.
    await expect(page.locator('.tutorial-scrim')).toBeVisible();
    await card.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.locator('.tutorial-spotlight')).toBeVisible({ timeout: 30_000 });

    expect(problems).toEqual([]);
  });

  test('salir a mitad pide confirmación y el progreso sobrevive a una recarga', async ({
    page,
  }) => {
    await mockPortal(page);
    await page.goto('/platform-health', { waitUntil: 'domcontentloaded' });

    // Se lanza el recorrido de bienvenida desde la ayuda de la propia pantalla.
    // Cuando la vista tiene además guía de lectura, el botón abre un menú y hay
    // que elegir el modo interactivo; si sólo hay uno, arranca directo.
    await page
      .getByRole('button', { name: /Tutorial/ })
      .first()
      .click();
    const guided = page.getByRole('menuitem', { name: /Recorrido guiado/ });
    if (await guided.isVisible().catch(() => false)) await guided.click();

    const card = page.locator('.tutorial-tooltip');
    await expect(card).toBeVisible({ timeout: 30_000 });

    // Avanzar con el teclado, como haría quien no usa ratón.
    await page.keyboard.press('ArrowRight');
    await expect(card).toContainText('paso 2 de');

    // Salir a medias pregunta antes de tirar el avance.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Seguir aquí' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(card).toContainText('paso 2 de');

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Sí, salir' }).click();
    await expect(card).toHaveCount(0);

    // Tras recargar, el Centro ofrece CONTINUAR: el paso se guardó.
    await page.goto('/tutorials', { waitUntil: 'domcontentloaded' });
    const welcome = tutorialCard(page, 'Qué es ATLAS y cómo se usa');
    await expect(welcome.getByRole('button', { name: /Continuar/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(welcome).toContainText('Lo dejaste en el paso 2');
  });

  test('un recorrido de ficha lleva al listado, pide abrir un registro y se queda en él', async ({
    page,
  }) => {
    const problems = collectProblems(page);
    await mockDensePortal(page);

    await page.goto('/tutorials', { waitUntil: 'domcontentloaded' });
    await tutorialCard(page, 'Ficha del artefacto')
      .getByRole('button', { name: /Comenzar/ })
      .click();

    // 1. Lleva al LISTADO, no a una ficha inventada.
    await expect(page).toHaveURL(/\/artifacts$/, { timeout: 30_000 });
    const card = page.locator('.tutorial-tooltip');
    await expect(card).toContainText('Abre un artefacto', { timeout: 30_000 });
    // Y resalta la tabla, que es donde hay que pulsar.
    await expect(page.locator('.tutorial-spotlight')).toBeVisible({ timeout: 30_000 });

    // 2. El paso espera el clic REAL: no ofrece "Siguiente".
    await expect(card.getByRole('button', { name: /^Siguiente/ })).toHaveCount(0);

    // 3. Al abrir un registro, el recorrido entra en la ficha con él.
    //    Se abre con el icono "Ver detalle" de la fila, NO pulsando la fila:
    //    en esta tabla el clic sobre la fila la despliega. El paso del tutorial
    //    dice exactamente eso, y esta prueba lo ejerce como está escrito.
    await page
      .locator('[data-tutorial-id="resource-table"]')
      .getByRole('link', { name: 'Ver detalle' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/artifacts\/[^/]+$/, { timeout: 30_000 });
    await expect(card).toContainText('Qué es esta pantalla', { timeout: 30_000 });

    // 4. Y NO rebota al listado. Éste es el fallo que evita `dynamicRoute`:
    //    sin él, cada paso heredaba la ruta del listado y devolvía a la persona
    //    allí en bucle, dejando el recorrido imposible de terminar.
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/artifacts\/[^/]+$/);

    expect(problems).toEqual([]);
  });

  test('la invitación introductoria se puede silenciar y no vuelve', async ({ page }) => {
    await mockPortal(page);
    await page.goto('/platform-health', { waitUntil: 'domcontentloaded' });

    const prompt = page.getByText('¿Primera vez por aquí?');
    await expect(prompt).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'No volver a mostrar' }).click();
    await expect(prompt).toHaveCount(0);

    // Tras recargar sigue sin aparecer: la preferencia se guardó de verdad.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.dash-grid')).toBeVisible({ timeout: 30_000 });
    await expect(prompt).toHaveCount(0);
  });

  test('el Centro se puede usar en un teléfono sin desbordes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockPortal(page);

    await page.goto('/tutorials', { waitUntil: 'domcontentloaded' });
    // Por nivel: "Centro de Tutoriales" es también el título de una tarjeta del
    // catálogo (el recorrido que enseña a usar esta pantalla).
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Centro de Tutoriales', {
      timeout: 30_000,
    });

    // Nada puede empujar el ancho del documento más allá de la ventana.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
