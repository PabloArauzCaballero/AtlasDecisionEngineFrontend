import { expect, test } from '@playwright/test';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * «Workers» en el cajón: un grupo que se despliega en los cinco.
 *
 * Vive aparte de `workers.spec.ts` porque no mide lo mismo. Aquélla comprueba
 * que una vista de worker funciona; ésta, que se puede LLEGAR a ella —y llegar
 * es la mitad del cambio: los cinco workers tenían ruta propia desde el
 * principio y aun así sólo se alcanzaban desde una fila de pestañas escondida
 * dentro de la página, que no se puede enlazar ni marcar como favorita.
 */

const SEMANTICO = '/workers/semantic-analysis';

test.describe('grupo Workers del cajón', () => {
  test.setTimeout(180_000);

  test('el grupo del cajón despliega todos los workers y lleva a cada uno', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(SEMANTICO, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });

    // La sección tiene que existir en el cajón: una vista a la que sólo se
    // llega escribiendo la URL, en la práctica, no existe.
    const cajon = page.locator('.sidebar');
    await expect(cajon.getByText('Procesamiento', { exact: false })).toBeVisible();

    // El grupo se abre solo al entrar por la ruta de un worker: si no, el raíl
    // no marcaría en qué página estás.
    const grupo = cajon.getByRole('button', { name: /Workers/i });
    await expect(grupo).toHaveAttribute('aria-expanded', 'true');

    // Los cinco cuelgan de él como destinos, no como estados de una pantalla.
    for (const nombre of [
      'Análisis semántico',
      'Extractos bancarios',
      'Identidad',
      'Locución',
      'Documentos PDF',
    ]) {
      await expect(cajon.getByRole('link', { name: nombre, exact: true })).toBeVisible();
    }

    // Y navegar de verdad: cambia la ruta y el título, no una pestaña interna.
    await cajon.getByRole('link', { name: 'Extractos bancarios', exact: true }).click();
    await expect(page).toHaveURL(/\/workers\/bank-statement/);
    await expect(page.getByRole('heading', { name: 'Extractos Bancarios' })).toBeVisible();

    await cajon.getByRole('link', { name: 'Locución', exact: true }).click();
    await expect(page).toHaveURL(/\/workers\/audio-tts/);
    await expect(page.getByRole('heading', { name: 'Locución' })).toBeVisible();
  });

  test('plegar el grupo deja la marca de dónde estás en la cabecera', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(SEMANTICO, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const cajon = page.locator('.sidebar');
    const grupo = cajon.getByRole('button', { name: /Workers/i });
    await grupo.click();

    await expect(grupo).toHaveAttribute('aria-expanded', 'false');
    // Plegado, la cabecera hereda el estado del hijo: cerrar el grupo no puede
    // borrar del raíl toda pista de en qué sección estás.
    await expect(grupo).toHaveClass(/active/);
    await expect(cajon.getByRole('link', { name: 'Análisis semántico' })).toBeHidden();
  });
});
