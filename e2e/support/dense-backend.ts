import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';

/**
 * Motor simulado con datos densos.
 *
 * El motor simulado normal devuelve páginas vacías, lo que estaba dejando fuera
 * de toda medición justo lo que más color tiene: las filas de las tablas, las
 * insignias de estado, los códigos monoespaciados y el texto que se trunca o se
 * envuelve. Una vista vacía enseña su cabecera y su estado vacío, y poco más.
 *
 * Este reparte a propósito TODAS las variantes de estado entre las filas —los
 * colores de estado son los que más fácil se quedan a medio migrar— y mete
 * textos largos para provocar truncados y saltos de línea.
 */

/** Estados que el portal pinta con color propio. Se reparten cíclicamente. */
const STATUSES = [
  'COMPLETED',
  'FAILED',
  'PENDING',
  'RUNNING',
  'APPROVED',
  'REJECTED',
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'BLOCKING',
  'WARNING',
  'DEPLOYED_TO_PROD',
];

const LONG_TEXT =
  'Motivo extenso que no cabe en su celda y obliga a la tabla a truncar o a ' +
  'envolver el texto, que es justo donde un color a medio migrar se nota';

/**
 * Fila con el superconjunto de campos que usan las tablas del portal. Cada
 * tabla toma los suyos e ignora el resto, así que una sola forma sirve para
 * todas y evita mantener un molde por recurso.
 */
function denseRow(index: number) {
  const status = STATUSES[index % STATUSES.length]!;
  return {
    id: `row-${index}`,
    // Códigos: se pintan monoespaciados y a veces con su propio color.
    variableCode: `VARIABLE_CON_NOMBRE_LARGO_${index}`,
    reasonCode: `RC_${index}`,
    artifactCode: `SCORING_CREDITO_CONSUMO_${index}`,
    requestId: `REQ-${index}-0000-0000`,
    name: `Registro número ${index} con un nombre deliberadamente largo`,
    // Todo lo que se pinta como insignia de estado.
    status,
    severity: status,
    usage: index % 2 === 0 ? 'INPUT' : 'OUTPUT',
    latestStatus: status,
    isActive: index % 3 !== 0,
    // Texto que desborda.
    publicMessage: LONG_TEXT,
    internalMessage: LONG_TEXT,
    description: LONG_TEXT,
    category: 'RIESGO_CREDITICIO',
    dataType: 'NUMBER',
    artifactType: 'DECISION_TREE',
    ownerTeam: 'Riesgo de Crédito y Cobranzas',
    environmentCode: index % 2 === 0 ? 'DEV' : 'TEST',
    latestVersion: `${index}.0.0`,
    lastValidatedAt: '2026-07-20T10:00:00Z',
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-07-21T18:30:00Z',
  };
}

function densePage(size = 25) {
  const items = Array.from({ length: size }, (_, index) => denseRow(index + 1));
  return { items, page: 1, pageSize: size, total: 137, totalPages: 6, hasNextPage: true };
}

/**
 * Intercepta el backend devolviendo listados llenos.
 *
 * Se registra DESPUÉS de `mockBackend` cuando ambos se usan: Playwright da
 * prioridad a la última ruta declarada.
 */
export async function denseBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/environments')) {
      return route.fulfill({
        json: [{ code: 'DEV' }, { code: 'TEST' }, { code: 'STAGING' }, { code: 'PROD' }],
      });
    }
    // Los contadores del panel de inicio piden totales, no listas.
    if (url.includes('unread-count')) return route.fulfill({ json: { unread: 4 } });
    return route.fulfill({ json: densePage() });
  });
}
