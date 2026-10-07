import type { Page, Route } from '@playwright/test';
import { governanceBackend } from './governance-backend';

/**
 * Motor simulado para «nueva versión» y «enviar a revisión»: el de gobierno, más el clonado, el envío a revisión,
 * las suites de una versión y la generación de la suite de cobertura. Vive aparte para que la prueba se lea como
 * el recorrido que comprueba, no como el servidor que finge.
 */
export const ARTIFACT = {
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
export const SUITE_EN_VERDE = {
  id: '6',
  suiteCode: 'DESENLACES',
  isBlocking: true,
  cases: [{ id: '1', isActive: true }],
  runs: [
    {
      id: '9',
      status: 'PASSED',
      finishedAt: '2026-10-07T01:00:00Z',
      coverage: [
        {
          coverageType: 'NODE',
          coveragePercentage: '100',
          detailsJson: { covered: ['START', 'EVALUAR', 'APROBAR'], missing: [] },
        },
      ],
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

export interface Capturas {
  clon: unknown;
  enviadas: string[];
  generadas: number;
}

export async function backend(
  page: Page,
  opciones: { rechazo?: string; suites?: unknown[] } = {},
): Promise<Capturas> {
  const capturas: Capturas = { clon: null, enviadas: [], generadas: 0 };
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
    if (
      peticion.method() === 'POST' &&
      /\/artifact-versions\/(70|5)\/submit-for-review$/.test(url)
    ) {
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
    if (peticion.method() === 'POST' && url.endsWith('/artifact-versions/5/test-suites/generate')) {
      capturas.generadas += 1;
      return route.fulfill({
        status: 201,
        json: {
          suiteId: '6',
          suiteCode: 'AUTO-COBERTURA',
          runId: '9',
          generation: 1,
          cases: 9,
          complete: true,
          exhaustedBudget: false,
          executions: 9,
          nodes: { percentage: 100, missing: [] },
          edges: { percentage: 100, missing: [] },
        },
      });
    }
    if (/\/artifact-versions\/(70|5)\/test-suites/.test(url)) {
      // La versión 5 no tiene pruebas hasta que se generan; después, la suite automática en verde.
      const delCinco = capturas.generadas
        ? [{ ...SUITE_EN_VERDE, suiteCode: 'AUTO-COBERTURA' }]
        : [];
      const items = url.includes('/5/') ? delCinco : (opciones.suites ?? [SUITE_EN_VERDE]);
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
