import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';

/**
 * Motor simulado para el simulador de decisión, con TRAZA.
 *
 * El simulado general no responde `/v1/simulations/...`, así que contra él la
 * pantalla nunca llega a tener resultado y el recorrido paso a paso —donde
 * están los defectos que esta prueba vigila— no se pinta nunca.
 *
 * Los valores son deliberadamente LARGOS: un base64 de documento y una glosa de
 * varias palabras. El desbordamiento horizontal sólo aparece cuando el contenido
 * no cabe, así que una traza de juguete con valores de tres letras mediría una
 * tabla que nunca desborda y daría por bueno el defecto.
 */

const ARTIFACT = 'EXTRACTO_CAPACIDAD_PAGO';

const ENVIRONMENTS = [
  {
    id: '1',
    code: 'SANDBOX',
    name: 'Sandbox',
    environmentType: 'SANDBOX',
    status: 'ACTIVE',
    isProduction: false,
    createdAt: '2026-08-02T23:37:40.068Z',
  },
];

const CONTRACT = {
  artifactCode: ARTIFACT,
  versionId: '1089',
  versionNumber: 1,
  variables: [
    {
      variableCode: 'extracto_pdf_base64',
      canonicalName: 'Extracto bancario (PDF en base64)',
      dataType: 'STRING',
      usageType: 'INPUT',
      isRequired: true,
    },
    {
      variableCode: 'cuota_solicitada_extracto',
      canonicalName: 'Cuota mensual solicitada',
      dataType: 'DECIMAL',
      usageType: 'INPUT',
      isRequired: true,
    },
  ],
};

/** Un valor largo de verdad: es lo que hace ancha la tabla de la traza. */
const BASE64 = 'JVBERi0xLjQKJZOMi54gUmVzb3VyY2VzIDw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4'.repeat(2);

function step(nodeKey: string, index: number) {
  return {
    nodeKey,
    durationUs: 72 + index,
    variableState: {
      nodeKey,
      status: 'COMPLETED',
      durationUs: 72 + index,
      inputs: [
        {
          code: 'extracto_pdf_base64',
          dataType: 'STRING',
          state: 'VALID',
          origin: 'REQUEST',
          value: BASE64,
        },
        {
          code: 'cuota_solicitada_extracto',
          dataType: 'DECIMAL',
          state: 'VALID',
          origin: 'REQUEST',
          value: 150000.55,
        },
      ],
      intermediatesBefore: [],
      intermediatesAfter: [
        {
          code: 'ext_motivo_rechazo_detallado',
          dataType: 'STRING',
          state: 'COMPUTED',
          value: 'El extracto no alcanza a cubrir la cuota solicitada con el margen exigido',
          producerNodeKey: nodeKey,
          createdAtStepIndex: index,
          consumedByNodeKeys: ['EVALUAR', 'RECHAZAR'],
        },
      ],
      intermediatesCreated: index === 0 ? ['ext_motivo_rechazo_detallado'] : [],
      intermediatesUpdated: [],
      outputs: [],
      errors: [],
      warnings: [],
    },
  };
}

const NODES = ['START', 'ANALIZAR_EXTRACTO', 'DERIVAR_CAPACIDAD', 'EVALUAR', 'RECHAZAR'];

const SIMULATION = {
  simulation: true,
  persisted: false,
  requestId: 'sim-e2e-0001',
  status: 'COMPLETED',
  outcome: 'DECLINED',
  output: { decision_extracto: 'DECLINED' },
  primaryResult: { code: 'decision_extracto', value: 'DECLINED' },
  reasonCodes: [],
  artifact: {
    code: ARTIFACT,
    versionId: '1089',
    deploymentId: '127',
    environment: 'SANDBOX',
    checksum: 'c6249fa1',
  },
  trace: {
    nodes: NODES,
    edges: ['E1', 'E2', 'E3', 'E4'],
    terminal: 'RECHAZAR',
    steps: NODES.map(step),
  },
  durationMs: 7,
};

/** Instala el motor simulado del simulador, con una traza que se puede medir. */
export async function mockSimulatorBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/environments')) return route.fulfill({ json: ENVIRONMENTS });
    if (url.includes('/v1/views/artifact-inputs')) return route.fulfill({ json: CONTRACT });
    if (url.includes('/v1/views/pickers/artifacts')) {
      return route.fulfill({
        json: [{ artifactCode: ARTIFACT, name: 'Capacidad de pago verificada por extracto' }],
      });
    }
    // Hay despliegue activo: sin esto la vista impide ejecutar, y con razón.
    if (url.includes('/v1/deployments')) {
      return route.fulfill({
        json: {
          items: [{ isActive: true, environment: ENVIRONMENTS[0] }],
          page: 1,
          pageSize: 50,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
        },
      });
    }
    if (url.includes('/v1/simulations/') && route.request().method() === 'POST') {
      return route.fulfill({ json: SIMULATION });
    }
    return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 } });
  });
}
