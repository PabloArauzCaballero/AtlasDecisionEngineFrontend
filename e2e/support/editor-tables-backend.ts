import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';
import { GRAPH } from './graph-fixtures';

/**
 * Motor simulado para las vistas que se miden por su composición.
 *
 * El motor simulado normal devuelve listados vacíos, y una tabla vacía no
 * desborda: mediría la cabecera y el estado vacío creyendo que mide la vista.
 * Aquí los casos de prueba traen payloads del tamaño real —ocho campos, más de
 * 200 caracteres serializados— porque es justo ese tamaño el que sacaba la
 * tabla de su columna.
 */

const CASOS = Array.from({ length: 22 }, (_, i) => ({
  id: `tc-${i}`,
  caseCode: `DECLINE_SCENARIO_${i}`,
  testName: `Rechaza por motivo número ${i} con un nombre largo de escenario`,
  tagsJson: ['negative', 'affordability'],
  inputJson: {
    age: 34,
    kyc_status: 'VERIFIED',
    pep_status: 'CLEAR',
    monthly_income: 5400,
    bureau_score: 712,
    requested_amount: 12000,
    term_months: 24,
    employment_status: 'SALARIED',
  },
  expectedResultJson: {
    reasonCodes: ['AFFORDABILITY_RATIO_EXCEEDED'],
    decision: 'DECLINE',
    score: 0.42,
  },
  isActive: true,
}));

const SUITE_PICKER = [
  {
    id: '4',
    suiteCode: 'BNPL_ORIGINATION',
    artifactCode: 'BNPL_CREDIT_DECISION',
    versionNumber: 1,
    artifactVersionId: 'ver-demo',
  },
];

const VERSION_PICKER = [
  {
    id: 'ver-demo',
    artifactCode: 'BNPL_CREDIT_DECISION',
    semanticVersion: '1.0.0',
    status: 'DRAFT',
  },
];

const VACIO = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, hasNextPage: false };

export async function editorTablesBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/environments')) return route.fulfill({ json: [{ code: 'DEV' }] });
    if (url.includes('unread-count')) return route.fulfill({ json: { unread: 0 } });
    if (url.includes('/pickers/test-suites')) return route.fulfill({ json: SUITE_PICKER });
    if (url.includes('/pickers/artifact-versions')) return route.fulfill({ json: VERSION_PICKER });
    if (url.includes('/cases')) return route.fulfill({ json: CASOS });
    if (/\/v1\/artifact-versions\/[^/]+\/graph/.test(url)) return route.fulfill({ json: GRAPH });
    if (/\/v1\/artifact-versions\/[^/]+$/.test(url)) {
      return route.fulfill({ json: { id: 'ver-demo', lockVersion: 1, status: 'DRAFT' } });
    }
    return route.fulfill({ json: VACIO });
  });
}

/**
 * Elementos que se salen del marco de contenido.
 *
 * NO se mide con `documentElement.scrollWidth`: `.app-shell` lleva
 * `overflow-x: clip` y un contenedor recortado no propaga el ancho de su
 * contenido al documento, así que esa medida da cero con la vista rota (lo
 * demuestra `e2e/overflow-detector.spec.ts`). Se comparan cajas contra el marco.
 *
 * Se ignora lo que vive dentro de un contenedor desplazable propio —el mundo
 * del lienzo del grafo es mayor que la pantalla a propósito—: ahí desbordar es
 * el diseño, no el defecto.
 */
export async function desbordes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const marco = document.querySelector('.content')?.getBoundingClientRect();
    if (!marco) return ['no se encontró `.content`'];

    const dentroDeUnScroller = (el: Element): boolean => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.classList.contains('content')) return false;
        const overflow = getComputedStyle(p).overflow;
        if (overflow.includes('auto') || overflow.includes('scroll') || overflow.includes('hidden'))
          return true;
      }
      return false;
    };

    const fuera: string[] = [];
    document.querySelectorAll<HTMLElement>('.content *').forEach((el) => {
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || dentroDeUnScroller(el)) return;
      if (caja.right > marco.right + 2 || caja.left < marco.left - 2) {
        const nombre = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`;
        fuera.push(`${nombre} ocupa ${Math.round(caja.left)}..${Math.round(caja.right)}`);
      }
    });
    return fuera;
  });
}
