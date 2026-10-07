import { expect, test, type Page, type Route } from '@playwright/test';
import { governanceBackend } from './support/governance-backend';

/**
 * Crear una versión nueva y enviarla a revisión, a la vista.
 *
 * Tres huecos que se veían en TEST el 2026-10-06:
 * 1. «Nueva versión» sólo existía dentro de «Importar código»: en la ficha del algoritmo no había forma de
 *    cambiar uno ya aprobado.
 * 2. La bandeja de Revisiones era sólo una tabla: el formulario de envío vivía en una pantalla que ninguna ruta
 *    importaba, así que no se podía mandar a revisión una versión recién compilada.
 * 3. «Validar y compilar» saltaba de «Compilada» a «Aprobada y desplegada» sin enseñar la revisión, y sólo ofrecía
 *    un «Ir a Revisiones» que llevaba a esa tabla.
 */
const ARTIFACT = {
  id: '1',
  name: 'Scoring de crédito de consumo',
  artifactCode: 'SCORING_CREDITO_CONSUMO',
};
const COMPILADA = {
  id: '70',
  versionNumber: '7',
  semanticVersion: '1.7.0',
  status: 'COMPILED',
  artifact: ARTIFACT,
};
const SHOTS = process.env.PW_SHOTS_DIR;

interface Capturas {
  clon: unknown;
  enviadas: string[];
}

async function backend(page: Page, opciones: { rechazo?: string } = {}): Promise<Capturas> {
  const capturas: Capturas = { clon: null, enviadas: [] };
  await governanceBackend(page);
  let estado = 'COMPILED';
  await page.route('**/v1/**', (route: Route) => {
    const peticion = route.request();
    const url = peticion.url();
    if (peticion.method() === 'POST' && url.endsWith('/artifact-versions/55/clone')) {
      capturas.clon = peticion.postDataJSON();
      return route.fulfill({
        status: 201,
        json: { id: '77', versionNumber: '6', semanticVersion: '1.6.0', status: 'DRAFT' },
      });
    }
    if (peticion.method() === 'POST' && url.endsWith('/artifact-versions/70/submit-for-review')) {
      capturas.enviadas.push(url);
      if (opciones.rechazo) {
        return route.fulfill({
          status: 409,
          json: {
            type: 'about:blank',
            title: opciones.rechazo,
            status: 409,
            error: { code: opciones.rechazo, message: 'x' },
          },
        });
      }
      estado = 'IN_REVIEW';
      return route.fulfill({ status: 201, json: { id: '32', status: 'IN_REVIEW' } });
    }
    if (url.includes('/v1/views/pickers/artifact-versions')) {
      return route.fulfill({
        json: {
          items: [COMPILADA],
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
        },
      });
    }
    if (url.includes('/v1/views/pickers/artifacts')) {
      return route.fulfill({
        json: {
          items: [ARTIFACT],
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
        },
      });
    }
    if (/\/v1\/artifact-versions\/70(\?|$)/.test(url))
      return route.fulfill({ json: { ...COMPILADA, status: estado } });
    return route.fallback();
  });
  return capturas;
}

async function foto(page: Page, nombre: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${nombre}.png`, fullPage: true });
}

test.describe('nueva versión de un algoritmo', () => {
  test('la ficha ofrece «Nueva versión» cuando la última ya no es un borrador, y abre el editor sobre el clon', async ({
    page,
  }) => {
    const capturas = await backend(page);
    await page.goto('/artifacts/1', { waitUntil: 'domcontentloaded' });

    // La última (v1.5.0) está en revisión: «Editar borrador» sería abrir algo que el motor ya no deja guardar.
    await expect(page.getByRole('link', { name: /Editar borrador/ })).toHaveCount(0);
    const nueva = page.getByRole('button', { name: 'Nueva versión' }).first();
    await expect(nueva).toBeVisible();
    await expect(page.getByText(/Esta versión ya no se edita/)).toBeVisible();
    await foto(page, '1-ficha-con-nueva-version');

    await nueva.click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('parte de la v1.5.0');
    const crear = dialogo.getByRole('button', { name: /Crear borrador y abrir el editor/ });
    // Sin contar qué cambia no se crea: es lo que leerán quienes la aprueben.
    await expect(crear).toBeDisabled();
    await expect(dialogo.getByPlaceholder('2.3.0')).toHaveValue('1.6.0');
    await dialogo
      .locator('textarea')
      .fill('Rechaza a quien tiene una cuota vencida antes de puntuar.');
    await foto(page, '2-dialogo-nueva-version');
    await crear.click();

    await expect(page).toHaveURL(/\/graph-editor\?versionId=77/);
    expect(capturas.clon).toEqual({
      changeSummary: 'Rechaza a quien tiene una cuota vencida antes de puntuar.',
      semanticVersion: '1.6.0',
    });
  });
});

test.describe('enviar a revisión', () => {
  test('la bandeja de Revisiones deja enviar una versión compilada y enlaza la solicitud creada', async ({
    page,
  }) => {
    const capturas = await backend(page);
    await page.goto('/reviews?versionId=70', { waitUntil: 'domcontentloaded' });

    const panel = page.locator('[data-tutorial-id="reviews-submit"]');
    await expect(panel).toBeVisible();
    const enviar = panel.getByRole('button', { name: 'Enviar a revisión' });
    await expect(enviar).toBeEnabled();
    await foto(page, '3-revisiones-con-envio');
    await enviar.click();

    await expect(page.getByRole('link', { name: /Ver la solicitud REQ-32/ })).toBeVisible();
    expect(capturas.enviadas).toHaveLength(1);
    await foto(page, '4-revisiones-enviada');
  });

  test('si el motor la rechaza, dice por qué en lenguaje llano', async ({ page }) => {
    await backend(page, { rechazo: 'BLOCKING_TESTS_NOT_PASSED' });
    await page.goto('/reviews?versionId=70', { waitUntil: 'domcontentloaded' });

    await page
      .locator('[data-tutorial-id="reviews-submit"]')
      .getByRole('button', { name: 'Enviar a revisión' })
      .click();

    await expect(page.getByText(/pruebas bloqueantes no están en verde/)).toBeVisible();
  });

  test('«Validar y compilar» enseña la revisión como el paso que sigue y la envía desde ahí', async ({
    page,
  }) => {
    const capturas = await backend(page);
    await page.goto('/artifact-versions/70/compile', { waitUntil: 'domcontentloaded' });

    const pasos = page.locator('.wizard-steps li');
    await expect(pasos).toHaveCount(6);
    await expect(pasos.nth(2)).toContainText('Aquí está · Compilada');
    // El estado va en español, y la revisión es el paso que toca.
    await expect(page.locator('.wizard-steps')).not.toContainText('COMPILED');
    await expect(pasos.nth(3)).toContainText('Revisión');
    await expect(pasos.nth(3)).toContainText('Siguiente');
    await foto(page, '5-compilar-con-paso-de-revision');

    await page.locator('[data-tutorial-id="compile-submit-review"]').click();

    await expect(page.getByRole('link', { name: /Ver la solicitud REQ-32/ })).toBeVisible();
    await expect(pasos.nth(3)).toContainText('Aquí está · En revisión');
    expect(capturas.enviadas).toHaveLength(1);
    await foto(page, '6-compilar-enviada');
  });
});
