import { expect, test, type Page } from '@playwright/test';

/**
 * Client-side runtime error detector.
 *
 * Drives the real app in Chromium and fails on any uncaught page error or React
 * console error — the class of defect the unit/component suite cannot see
 * (hydration mismatches, bad effects, render-time crashes).
 *
 * The API is fully mocked with Playwright route interception, so the sweep needs
 * neither the Decision Engine backend nor real credentials: a forged session
 * makes the app believe it is authenticated, and every `/v1/*` call returns an
 * empty-but-valid envelope. That isolates the FRONTEND — network 5xx / failed
 * requests are environmental, not client defects, so they are ignored here.
 */

const PORTAL_ROUTES = [
  '/platform-health',
  '/variables',
  '/reason-codes',
  '/artifacts',
  '/objectives',
  '/deployments',
  '/reviews',
  '/manual-reviews',
  '/executions',
  '/audit-events',
  '/environments',
  '/simulator',
  '/test-suites',
  '/test-cases',
  '/graph-editor',
  '/graph-coverage',
  '/coverage-matrix',
  '/search',
];

/** Browser/tooling noise and environmental network failures — not client defects. */
const IGNORE = [/React DevTools/i, /favicon/i, /Failed to load resource/i, /ERR_ABORTED/i];

interface Problem {
  route: string;
  kind: string;
  detail: string;
}

function watch(page: Page, where: { route: string }, sink: Problem[]): void {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const detail = msg.text();
    if (IGNORE.some((rule) => rule.test(detail))) return;
    sink.push({ route: where.route, kind: 'console.error', detail });
  });
  page.on('pageerror', (error) => {
    sink.push({ route: where.route, kind: 'pageerror', detail: error.message });
  });
}

/** JWT the client will accept: only the payload is decoded (exp), never verified. */
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
    id: 'e2e-user',
    tenantId: '1',
    email: 'e2e@atlas.bo',
    fullName: 'E2E Tester',
    name: 'E2E',
    userCode: 'E2E',
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
  await page.route('**/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/refresh') || url.includes('/v1/session/login')) {
      return route.fulfill({ json: MOCK_SESSION });
    }
    if (url.includes('/v1/session/logout')) {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ json: EMPTY_PAGE });
  });
}

const report = (problems: Problem[]) =>
  `Client runtime problems:\n${JSON.stringify(problems, null, 2)}`;

test('login page has no client-side runtime errors', async ({ page }) => {
  const problems: Problem[] = [];
  const where = { route: '/login' };
  watch(page, where, problems);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Inicia sesión/i })).toBeVisible();

  expect(problems, report(problems)).toEqual([]);
});

test('authenticated portal sweep has no client-side runtime errors', async ({ page }) => {
  // Dev-mode Turbopack compiles each route on first visit, so the whole sweep
  // needs a generous budget; per-navigation we only wait for the DOM + shell.
  test.setTimeout(240_000);
  const problems: Problem[] = [];
  const where = { route: '/platform-health' };
  watch(page, where, problems);
  await mockBackend(page);

  await page.goto('/platform-health', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });

  for (const route of PORTAL_ROUTES) {
    where.route = route;
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // The client shell mounts, then mocked queries settle — where render/effect
    // errors surface. networkidle is avoided: the dev HMR socket never idles.
    await page.locator('.app-main, .content, main').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(250);
  }

  expect(problems, report(problems)).toEqual([]);
});

test('real-backend portal sweep (opt-in via PW_EMAIL / PW_PASSWORD)', async ({ page }) => {
  // Opt-in: needs the Decision Engine running and real credentials. Catches
  // client crashes that only real data shapes trigger — which the mocked sweep,
  // returning empty envelopes, cannot. Skips instantly when unconfigured.
  const email = process.env.PW_EMAIL;
  const password = process.env.PW_PASSWORD;
  test.skip(!email || !password, 'Set PW_EMAIL / PW_PASSWORD (backend up) to run this.');
  test.setTimeout(240_000);

  const problems: Problem[] = [];
  const where = { route: '/login' };
  watch(page, where, problems);

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // Target the inputs by autocomplete: the visible labels also cover the
  // "Mostrar contraseña" toggle button, which makes getByLabel ambiguous.
  await page.getByLabel('Tenant').fill(process.env.PW_TENANT ?? '1');
  await page.locator('input[autocomplete="username"]').fill(email as string);
  await page.locator('input[autocomplete="current-password"]').fill(password as string);
  await page.getByRole('button', { name: 'Autenticar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });

  for (const route of PORTAL_ROUTES) {
    where.route = route;
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.app-main, .content, main').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(250);
  }

  expect(problems, report(problems)).toEqual([]);
});

test('every tool exposes an in-page tutorial that opens, steps and closes', async ({ page }) => {
  test.setTimeout(180_000);
  const problems: Problem[] = [];
  const where = { route: '/platform-health' };
  watch(page, where, problems);
  await mockBackend(page);

  // Unified tutorial: one "Tutorial" button per tool. If both modes exist it opens a
  // menu (guided / read); otherwise it acts directly. Either way a panel opens/closes.
  const sample = ['/variables', '/graph-editor', '/simulator', '/deployments'];
  for (const route of sample) {
    where.route = route;
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('button', { name: 'Tutorial' }).first().click();
    const guided = page.getByRole('menuitem', { name: /Recorrido guiado/ });
    if (await guided.isVisible().catch(() => false)) await guided.click();
    const panel = page.locator('.tutorial-overlay, .tutorial-drawer').first();
    await expect(panel).toBeVisible();
    // Both the interactive overlay and the read drawer close on Escape.
    await page.keyboard.press('Escape');
    await expect(page.locator('.tutorial-overlay, .tutorial-drawer')).toHaveCount(0);
  }

  expect(problems, report(problems)).toEqual([]);
});

test('list filters send the real backend query param', async ({ page }) => {
  test.setTimeout(120_000);
  const problems: Problem[] = [];
  const where = { route: '/artifacts' };
  watch(page, where, problems);
  await mockBackend(page);

  const artifactRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/v1/artifacts')) artifactRequests.push(url);
  });

  await page.goto('/artifacts', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.app-main, .content, main').first().waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Más filtros' }).click();
  await page.getByLabel('Estado').selectOption('APPROVED');

  await expect
    .poll(() => artifactRequests.some((url) => url.includes('status=APPROVED')), {
      timeout: 10_000,
    })
    .toBe(true);
  expect(problems, report(problems)).toEqual([]);
});

test('create forms and the deployment dialog open without errors', async ({ page }) => {
  const problems: Problem[] = [];
  const where = { route: '/variables' };
  watch(page, where, problems);
  await mockBackend(page);

  await page.goto('/variables');
  await page.getByRole('button', { name: /Add Variable/i }).click();
  await expect(page.getByRole('button', { name: /Add Variable/i }).last()).toBeVisible();

  where.route = '/deployments';
  await page.goto('/deployments');
  await page.getByRole('button', { name: /Nuevo Despliegue/i }).click();
  await expect(page.getByRole('heading', { name: /Nuevo despliegue/i })).toBeVisible();

  expect(problems, report(problems)).toEqual([]);
});
