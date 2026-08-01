import type { Page } from '@playwright/test';

/**
 * Backend simulado compartido por las especificaciones visuales.
 *
 * Intercepta `/v1/**` y `/health/**` con respuestas válidas y con volumen, de
 * modo que las pruebas ejercitan el frontend real sin necesitar el Decision
 * Engine ni credenciales. Vive aparte para que las especificaciones no dupliquen
 * la sesión forjada ni los sobres de paginación.
 */

/** Ruido del navegador y fallos de red del entorno: no son defectos del cliente. */
const IGNORE = [/React DevTools/i, /favicon/i, /Failed to load resource/i, /ERR_ABORTED/i];

/** Acumula errores de consola y excepciones sin capturar de la página. */
export function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (IGNORE.some((rule) => rule.test(msg.text()))) return;
    problems.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

/** JWT que el cliente acepta: sólo decodifica el payload (exp), nunca lo verifica. */
function forgedJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return `${header}.${payload}.mock`;
}

export const MOCK_SESSION = {
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

export const EMPTY_PAGE = {
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
};

export const EXECUTIONS_PAGE = {
  items: [
    {
      id: 'exec-1',
      requestId: 'REQ-1',
      artifactCode: 'SCORING_CREDITO',
      environmentCode: 'SANDBOX',
      status: 'COMPLETED',
      createdAt: '2026-07-20T10:00:00Z',
    },
    {
      id: 'exec-2',
      requestId: 'REQ-2',
      artifactCode: 'TRIAGE_FRAUDE',
      environmentCode: 'TEST',
      status: 'FAILED',
      createdAt: '2026-07-20T11:00:00Z',
    },
  ],
  page: 1,
  pageSize: 6,
  total: 42,
  totalPages: 7,
  hasNextPage: true,
};

export interface MockOptions {
  /**
   * Fuerza este estado en todo `/v1/session/**`. Con el login fallando, la
   * restauración de sesión también debe fallar: si `refresh` devolviera una
   * sesión válida, la aplicación saldría del acceso y no habría formulario que
   * probar.
   */
  loginStatus?: number;
}

export async function mockBackend(page: Page, options: MockOptions = {}): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (options.loginStatus && url.includes('/v1/session/')) {
      return route.fulfill({
        status: options.loginStatus,
        json: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' },
      });
    }
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/audit/executions')) return route.fulfill({ json: EXECUTIONS_PAGE });
    if (url.includes('/v1/artifacts')) return route.fulfill({ json: { ...EMPTY_PAGE, total: 12 } });
    // La calidad de las pruebas se cuenta desde la bitácora, un evento por
    // ejecución terminada, igual que contra el backend real.
    if (url.includes('TEST_RUN_PASSED'))
      return route.fulfill({ json: { ...EMPTY_PAGE, total: 30 } });
    if (url.includes('TEST_RUN_FAILED'))
      return route.fulfill({ json: { ...EMPTY_PAGE, total: 10 } });
    if (url.includes('/v1/environments')) {
      return route.fulfill({ json: [{ code: 'SANDBOX' }, { code: 'TEST' }] });
    }
    return route.fulfill({ json: EMPTY_PAGE });
  });
}
