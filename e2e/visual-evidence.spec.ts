import { expect, test, type Page } from '@playwright/test';
import { CODE_IMPORT_WARNING, EXECUTION, GRAPH, VARIABLES } from './support/graph-fixtures';

/**
 * Generador de evidencias visuales.
 *
 * Captura las pantallas que cambiaron con el rediseño y las deja en
 * `docs/visual-evidence/`. No afirma nada sobre el resultado (para eso están
 * las demás especificaciones): existe para poder revisar el aspecto real sin
 * levantar el entorno a mano, y para adjuntar el antes/después a una revisión.
 */

const OUT = 'docs/visual-evidence';

/**
 * Captura de página completa para la evidencia.
 *
 * `animations: 'disabled'` adelanta las animaciones de entrada a su fotograma
 * final. Sin ello la captura las reinicia y, como se declaran con `both`, las
 * congela en el estado inicial —opacidad cero—: paneles y filas desplegadas
 * salían como huecos en blanco y parecían un fallo de la interfaz.
 */
function capture(page: Page, name: string) {
  return page.screenshot({ path: `${OUT}/${name}`, fullPage: true, animations: 'disabled' });
}

function forgedJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return `${header}.${payload}.mock`;
}

const MOCK_SESSION = {
  accessToken: forgedJwt(),
  tokenType: 'Bearer',
  expiresIn: '3600',
  user: {
    id: 'evidence-user',
    tenantId: '1',
    email: 'demo@atlas.bo',
    fullName: 'Demo',
    name: 'Demo',
    userCode: 'DEMO',
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles: ['PLATFORM_ADMIN', 'RISK_ANALYST', 'COMPLIANCE', 'QA_ANALYST', 'AUDITOR', 'OPERATIONS'],
    legacyRoles: [],
    permissions: [],
  },
};

const EMPTY_PAGE = {
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
};

async function mockBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/graph')) return route.fulfill({ json: GRAPH });
    if (url.includes('/v1/audit/executions/')) return route.fulfill({ json: EXECUTION });
    if (url.includes('/v1/audit/executions')) {
      return route.fulfill({ json: { ...EMPTY_PAGE, items: [EXECUTION], total: 128 } });
    }
    // Respuesta real del motor ante un diccionario de resultado multilínea,
    // copiada de una ejecución contra el backend de desarrollo.
    if (url.includes('/v1/code-imports')) return route.fulfill({ json: CODE_IMPORT_WARNING });
    if (url.includes('/v1/artifacts')) return route.fulfill({ json: { ...EMPTY_PAGE, total: 12 } });
    if (url.includes('/v1/variables')) {
      return route.fulfill({ json: { ...EMPTY_PAGE, items: VARIABLES, total: VARIABLES.length } });
    }
    if (url.includes('/v1/environments')) {
      return route.fulfill({
        json: [{ code: 'DEV' }, { code: 'TEST' }, { code: 'STAGING' }, { code: 'PROD' }],
      });
    }
    return route.fulfill({ json: EMPTY_PAGE });
  });
}

test('captura las evidencias visuales del rediseño', async ({ page }) => {
  test.setTimeout(180_000);
  // Primero sin sesión: si `refresh` devolviera una válida, el acceso
  // redirigiría al portal y no habría login que capturar. Los manejadores
  // registrados después tienen prioridad, así que `mockBackend` lo sustituye
  // en cuanto hacen falta datos del portal.
  await page.route('**/v1/session/**', (route) =>
    route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Sin sesión' } }),
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('.login-panel').waitFor({ timeout: 30_000 });
  // Se mueve el puntero antes de capturar: el foco de luz y la red se revelan
  // alrededor del cursor, así que sin moverlo la evidencia no enseña la parte
  // reactiva del fondo.
  await page.mouse.move(380, 430, { steps: 12 });
  await page.waitForTimeout(500);
  await capture(page, '01-login-escritorio.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.login-panel').waitFor({ timeout: 30_000 });
  await capture(page, '02-login-movil.png');

  await mockBackend(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/platform-health', { waitUntil: 'domcontentloaded' });
  await page.locator('.dash-grid').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(900); // deja que los contadores lleguen a su valor real
  await capture(page, '03-panel-inicio.png');

  await page.goto('/executions/exec-demo', { waitUntil: 'domcontentloaded' });
  await page.locator('.playback').waitFor({ timeout: 30_000 });
  await capture(page, '04-reproduccion-inicio.png');
  await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await capture(page, '05-reproduccion-avanzada.png');

  await page.goto('/graph-editor', { waitUntil: 'domcontentloaded' });
  await page.locator('.graph-editor-page').waitFor({ timeout: 30_000 });
  await capture(page, '06-editor-de-grafo.png');

  await page.goto('/test-suites', { waitUntil: 'domcontentloaded' });
  await page.locator('.rich-empty-state').first().waitFor({ timeout: 30_000 });
  await capture(page, '07-qa-lab-estado-vacio.png');

  // Mismas pantallas en tema oscuro: la comparación lado a lado es la forma
  // más rápida de detectar un texto que se quedó sin contraste.
  await page.evaluate(() => window.localStorage.setItem('atlas.theme', 'dark'));

  await page.goto('/platform-health', { waitUntil: 'domcontentloaded' });
  await page.locator('.dash-grid').waitFor({ timeout: 30_000 });
  // El tema debe estar puesto antes de capturar; si no, la evidencia "oscura"
  // saldría en claro y no serviría para revisar contraste.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForTimeout(900);
  await capture(page, '08-panel-inicio-oscuro.png');

  await page.goto('/executions/exec-demo', { waitUntil: 'domcontentloaded' });
  await page.locator('.playback').waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await page.getByRole('button', { name: 'Paso siguiente' }).click();
  await capture(page, '09-reproduccion-oscuro.png');

  await page.goto('/graph-editor', { waitUntil: 'domcontentloaded' });
  await page.locator('.graph-editor-page').waitFor({ timeout: 30_000 });
  await capture(page, '10-editor-oscuro.png');
});

test('captura las correcciones de tablas, nodos y avisos del importador', async ({ page }) => {
  test.setTimeout(180_000);
  await mockBackend(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Tabla con búsqueda rápida, orden por columna y fila desplegada.
  await page.goto('/variables', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.data-table').waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: /Code/ }).click();
  await page.getByRole('button', { name: 'Ver el detalle completo' }).first().click();
  await capture(page, '13-tabla-herramientas.png');

  // Editor de grafo con un nodo de ACCIÓN seleccionado: qué hace y qué E/S tiene.
  await page.goto('/artifact-versions/ver-demo/graph', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.locator('.graph-canvas').waitFor({ timeout: 30_000 });
  await page
    .getByRole('button', { name: /Rechazo documental, nodo Acción/ })
    .click({ timeout: 30_000 });
  await page.locator('.node-io-panel').waitFor({ timeout: 30_000 });
  await capture(page, '14-nodo-accion.png');

  // Importador: el aviso del motor acompañado de causa y solución.
  await page.goto('/code-import', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByLabel('Lenguaje').selectOption('PYTHON');
  await page
    .getByLabel('Código')
    .fill(
      [
        '# @atlas-contract',
        '# { "contractVersion": "1" }',
        'result = {',
        '    "decision": "OK"',
        '}',
      ].join('\n'),
    );
  await page.getByRole('button', { name: 'Analizar' }).click();
  await page.locator('.issue-explanation').first().waitFor({ timeout: 30_000 });
  await capture(page, '15-importador-explicado.png');
});

test('captura el acceso en tema oscuro', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/v1/session/**', (route) =>
    route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Sin sesión' } }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.setItem('atlas.theme', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.login-panel').waitFor({ timeout: 30_000 });
  await capture(page, '11-login-oscuro.png');
});
