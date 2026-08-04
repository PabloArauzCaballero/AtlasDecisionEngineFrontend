import { expect, test } from '@playwright/test';
import { GRAPH } from './support/graph-fixtures';

/**
 * El editor no lleva lechada ambiental.
 *
 * Se reportó tres veces que el fondo del editor «no se ve estético». Las dos
 * primeras se atenuó (0.5 → 0.28) y se ocultó la trama de puntos duplicada;
 * seguía tiñendo de verde los paneles blancos y compitiendo con lo único que
 * importa mirar ahí, que son los nodos y sus conexiones. Atenuar hacía el
 * problema más tenue, no lo quitaba.
 *
 * Aquí se fija la decisión: en la variante `editor` —las siete superficies de
 * AUTORÍA: grafo, importación de código, artefactos, algoritmos, variables y
 * motivos— las capas de color del fondo no se pintan. En las de lectura
 * (`dashboard`, `lab`, `results`) se conservan, porque allí hay superficie libre
 * que ganar y nada con lo que competir.
 */
const SESSION = {
  accessToken: 'e2e-token',
  tokenType: 'Bearer' as const,
  expiresIn: '3600',
  user: {
    id: '1',
    tenantId: '1',
    email: 'qa@atlas.local',
    fullName: 'QA Atlas',
    name: 'QA Atlas',
    userCode: null,
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles: ['RISK_ANALYST', 'PLATFORM_ADMIN'],
    legacyRoles: [],
    permissions: [],
  },
};

async function mockPortal(page: import('@playwright/test').Page) {
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: SESSION });
    if (url.includes('/graph')) return route.fulfill({ json: GRAPH });
    if (url.includes('/v1/artifact-versions/')) {
      return route.fulfill({ json: { id: '1', lockVersion: 1, status: 'DRAFT' } });
    }
    return route.fulfill({
      json: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, hasNextPage: false },
    });
  });
}

const COLOUR_LAYERS = ['.ambient-aurora', '.ambient-spotlight', '.ambient-vignette'];

test('el editor no pinta ninguna capa de color del fondo ambiental', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPortal(page);
  await page.goto('/graph-editor', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.ambient-bg.ambient-editor')).toBeAttached({ timeout: 30_000 });

  for (const selector of COLOUR_LAYERS) {
    const shown = await page.evaluate((target) => {
      const layer = document.querySelector(`.ambient-editor ${target}`);
      return layer ? getComputedStyle(layer).display !== 'none' : false;
    }, selector);
    expect(shown, `${selector} no debe pintarse en el editor`).toBe(false);
  }
});

test('fuera de las superficies de trabajo el fondo ambiental sí se conserva', async ({ page }) => {
  test.setTimeout(120_000);
  await mockPortal(page);
  // `/platform-health` usa la variante `dashboard`: es una pantalla de lectura,
  // no una mesa de trabajo, así que ahí el fondo sigue aportando.
  await page.goto('/platform-health', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.ambient-bg')).toBeAttached({ timeout: 30_000 });

  // Si esto pasara a falso, se habría apagado el fondo del portal ENTERO en vez
  // de sólo el de las superficies de autoría, que es lo que se quiso hacer.
  const painted = await page.evaluate(() => {
    const layer = document.querySelector('.ambient-bg .ambient-spotlight');
    return layer ? getComputedStyle(layer).display !== 'none' : false;
  });
  expect(painted).toBe(true);
});
