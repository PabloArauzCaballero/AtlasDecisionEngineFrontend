import type { Page } from '@playwright/test';
import { EMPTY_PAGE, MOCK_SESSION } from './backend-mock';

/**
 * Motor simulado con una familia de árboles de decisión ANIDADOS (Fase 7).
 *
 * El motor simulado normal devuelve listados vacíos, y el grafo de dependencias
 * no lee un listado sino un OBJETO —`{nodes, edges, maxDepth}`— así que contra
 * él la vista pinta sus dos estados vacíos y una prueba escrita así mediría el
 * vacío creyendo que mide los paneles.
 *
 * La familia es la misma que siembra `docs/seed-arboles-anidados.py` contra el
 * motor real, y su forma está descrita en `docs/arboles-anidados.md`:
 *
 *         ORIGINACION_CONSUMO        LIMITE_TARJETA_CREDITO
 *                     \                    /
 *                      RIESGO_CREDITICIO          <- los dos paneles, poblados
 *                        /              \
 *         CAPACIDAD_PAGO_CONSUMO      SOLVENCIA_BURO
 *
 * `RIESGO_CREDITICIO` (703) es el único con dependencias Y dependientes; las
 * hojas y las raíces dejan un panel vacío a propósito, porque un estado vacío
 * honesto también hay que poder verlo.
 */

export const ARTIFACT_IDS = {
  capacidad: '701',
  solvencia: '702',
  riesgo: '703',
  originacion: '704',
  tarjeta: '705',
} as const;

function nodo(artifactId: string, artifactCode: string, name: string) {
  return { artifactId, artifactCode, name };
}

function arista(parentArtifactId: string, childArtifactId: string, nodeKey: string) {
  return {
    parentArtifactId,
    parentArtifactVersionId: `${parentArtifactId}1`,
    childArtifactId,
    childArtifactVersionId: `${childArtifactId}1`,
    nodeKey,
  };
}

export const DEPENDENCY_GRAPH = {
  maxDepth: 5,
  nodes: [
    nodo(ARTIFACT_IDS.capacidad, 'CAPACIDAD_PAGO_CONSUMO', 'Capacidad de pago de consumo'),
    nodo(ARTIFACT_IDS.solvencia, 'SOLVENCIA_BURO', 'Solvencia de buró'),
    nodo(ARTIFACT_IDS.riesgo, 'RIESGO_CREDITICIO', 'Riesgo crediticio del solicitante'),
    nodo(ARTIFACT_IDS.originacion, 'ORIGINACION_CONSUMO', 'Originación de crédito de consumo'),
    nodo(ARTIFACT_IDS.tarjeta, 'LIMITE_TARJETA_CREDITO', 'Límite de tarjeta de crédito'),
  ],
  // Las dos raíces comparten el mismo motor de riesgo: ahí está la reutilización
  // que justifica anidar, y es lo que llena el panel de dependientes.
  edges: [
    arista(ARTIFACT_IDS.originacion, ARTIFACT_IDS.riesgo, 'EVALUA_RIESGO'),
    arista(ARTIFACT_IDS.tarjeta, ARTIFACT_IDS.riesgo, 'TC_EVALUA_RIESGO'),
    arista(ARTIFACT_IDS.riesgo, ARTIFACT_IDS.capacidad, 'RIESGO_POR_CAPACIDAD'),
    arista(ARTIFACT_IDS.riesgo, ARTIFACT_IDS.solvencia, 'RIESGO_POR_SOLVENCIA'),
  ],
};

/**
 * El grafo completo se sirve para CUALQUIER artefacto de la familia: el motor
 * devuelve el vecindario entero y es la vista quien separa dependencias de
 * dependientes filtrando por el artefacto abierto. Servir un recorte por ruta
 * escondería justo el filtro que la prueba quiere comprobar.
 */
export async function nestedTreesBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('unread-count')) return route.fulfill({ json: { unread: 0 } });
    if (url.includes('/dependency-graph')) return route.fulfill({ json: DEPENDENCY_GRAPH });
    return route.fulfill({ json: EMPTY_PAGE });
  });
}
