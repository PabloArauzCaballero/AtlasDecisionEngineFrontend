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
const SUITE_EN_VERDE = {
  id: '6',
  suiteCode: 'DESENLACES',
  isBlocking: true,
  cases: [{ id: '1' }],
  runs: [
    {
      id: '9',
      status: 'PASSED',
      finishedAt: '2026-10-07T01:00:00Z',
      coverage: [{ coverageType: 'NODE', coveragePercentage: '100', detailsJson: { missing: [] } }],
    },
  ],
};
// El caso de TEST del 2026-10-07: nombre largo, compilada y SIN ninguna suite de pruebas.
const IDENTIDAD = {
  id: '5',
  versionNumber: '2',
  semanticVersion: '1.2.1',
  status: 'COMPILED',
  artifact: {
    id: '2',
    name: 'Verificación de identidad con carnet para el front móvil de la app del cliente',
    artifactCode: 'IDENTIDAD_CARNET_MOVIL',
  },
};

interface Capturas {
  clon: unknown;
  enviadas: string[];
}

async function backend(
  page: Page,
  opciones: { rechazo?: string; suites?: unknown[] } = {},
): Promise<Capturas> {
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
    if (/\/artifact-versions\/(70|5)\/test-suites/.test(url)) {
      const items = url.includes('/5/') ? [] : (opciones.suites ?? [SUITE_EN_VERDE]);
      return route.fulfill({
        json: {
          items,
          page: 1,
          pageSize: 50,
          total: items.length,
          totalPages: 1,
          hasNextPage: false,
        },
      });
    }
    if (/\/v1\/artifact-versions\/5(\?|$)/.test(url)) return route.fulfill({ json: IDENTIDAD });
    if (url.includes('/v1/views/pickers/artifact-versions') && url.includes('IDENTIDAD')) {
      return route.fulfill({
        json: {
          items: [IDENTIDAD],
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
        },
      });
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
          items: [ARTIFACT, IDENTIDAD.artifact],
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

    await expect(page.getByText(/no la aceptó por sus pruebas/)).toBeVisible();
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

  test('sin ninguna suite dice que hay que CREARLAS y lleva directo a las pruebas de esa versión', async ({
    page,
  }) => {
    const capturas = await backend(page);
    await page.addInitScript(() => window.localStorage.setItem('atlas.theme', 'dark'));
    await page.goto('/reviews?versionId=5', { waitUntil: 'domcontentloaded' });

    const panel = page.locator('[data-tutorial-id="reviews-submit"]');
    const requisitos = panel.locator('[data-tutorial-id="review-readiness"]');
    await expect(requisitos).toContainText('no tiene ninguna suite de pruebas');
    await expect(requisitos).toContainText('NO se heredan');
    const ir = requisitos.getByRole('link', { name: /Crear las pruebas de esta versión/ });
    await expect(ir).toHaveAttribute('href', '/artifact-versions/5/test-suites');
    // No se ofrece pulsar algo que el motor va a rechazar.
    await expect(panel.getByRole('button', { name: 'Enviar a revisión' })).toBeDisabled();
    expect(capturas.enviadas).toHaveLength(0);

    // El bug visual: con un nombre largo, el BOTÓN del selector de artefacto se salía de su campo y se metía
    // debajo del de versión. Se miden los botones, no las columnas: las columnas ya medían bien.
    const botones = await panel
      .locator('.artifact-version-picker .option-select-button')
      .evaluateAll((nodos) => nodos.map((nodo) => nodo.getBoundingClientRect().toJSON()));
    expect(botones).toHaveLength(2);
    expect(botones[1].left - botones[0].right).toBeGreaterThanOrEqual(8);
    const recortado = await panel
      .locator('.artifact-version-picker .option-select-value')
      .first()
      .evaluate((nodo) => nodo.scrollWidth > nodo.clientWidth);
    // El nombre no cabe: se recorta con elipsis en vez de empujar.
    expect(recortado).toBe(true);
    await foto(page, '7-identidad-sin-suites-oscuro');

    await ir.click();
    await expect(page).toHaveURL(/\/artifact-versions\/5\/test-suites/);
  });

  test('con la corrida en rojo lleva a ver qué casos fallaron', async ({ page }) => {
    const roja = {
      ...SUITE_EN_VERDE,
      runs: [{ id: '12', status: 'FAILED', finishedAt: '2026-10-07T02:00:00Z', coverage: [] }],
    };
    await backend(page, { suites: [roja] });
    await page.goto('/artifact-versions/70/compile', { waitUntil: 'domcontentloaded' });

    const requisitos = page.locator('[data-tutorial-id="review-readiness"]');
    await expect(requisitos).toContainText('no pasó');
    await expect(requisitos.getByRole('link', { name: /Ver qué casos fallaron/ })).toHaveAttribute(
      'href',
      '/test-runs/12',
    );
    await expect(page.locator('[data-tutorial-id="compile-submit-review"]')).toBeDisabled();
    await foto(page, '8-compilar-con-corrida-en-rojo');
  });
});
