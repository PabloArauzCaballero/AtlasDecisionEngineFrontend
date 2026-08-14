import type { Page } from '@playwright/test';
import { MOCK_SESSION } from './backend-mock';

/**
 * Motor simulado para las vistas de contrato y de desenlaces.
 *
 * Los payloads NO son inventados: se copiaron de lo que devuelve el motor local
 * —`GET /v1/variables/79`, `GET /v1/calculated-fields/80`,
 * `POST /v1/simulations/BNPL_CREDIT_DECISION/sample-inputs` con `kind: OUTCOMES`— así
 * que lo que la prueba mide es la vista pintando la forma REAL, no una de juguete que
 * pasaría igual aunque el contrato hubiera cambiado.
 */

const ARTIFACT = 'BNPL_CREDIT_DECISION';

/** `device_reputation`: enumeración de cuatro valores y una fuente autoritativa. */
export const VARIABLE_79 = {
  id: '79',
  variableCode: 'device_reputation',
  canonicalName: 'Reputación de dispositivo',
  businessDescription: 'Clasificación de reputación del dispositivo según proveedor antifraude.',
  dataClassification: 'INTERNAL',
  ownerTeam: 'RISK_DECISIONING',
  isSensitive: false,
  isActive: true,
  sensitivityClass: 'INTERNAL',
  lifecycleState: 'ACTIVE',
  decisionUseRestriction: 'NONE',
  versions: [
    {
      id: '78',
      versionNumber: 1,
      dataType: 'STRING',
      nullable: false,
      expectedOrigin: 'REQUEST',
      effectiveFrom: '2026-08-02T23:37:45.254Z',
      effectiveTo: null,
      unitCode: null,
      defaultValueJson: null,
      validationMessage: null,
      exampleValidJson: null,
      exampleInvalidJson: null,
      constraintsJson: { enum: ['TRUSTED', 'NEUTRAL', 'SUSPICIOUS', 'BLOCKLISTED'] },
      validationSchemaJson: { enum: ['TRUSTED', 'NEUTRAL', 'SUSPICIOUS', 'BLOCKLISTED'] },
      sources: [
        {
          id: '78',
          sourceSystemCode: 'REQUEST_PAYLOAD',
          sourcePath: '$.variables',
          sourceField: 'device_reputation',
          freshnessSlaSeconds: 60,
          precedence: 1,
          isAuthoritative: true,
        },
      ],
      validationRules: [],
    },
  ],
};

/** `payment_headroom_ratio`: rango 0–50, dos decimales, RETURN_DEFAULT fuera de rango. */
export const CALCULATED_FIELD_80 = {
  id: '80',
  fieldCode: 'payment_headroom_ratio',
  name: 'Colchón de pago',
  description: 'Cuántas veces cabe la cuota en el ingreso disponible.',
  category: 'AFFORDABILITY',
  ownerTeam: 'RISK_DECISIONING',
  isActive: true,
  versions: [
    {
      id: '8',
      versionNumber: 1,
      status: 'APPROVED',
      implementationKind: 'JAVASCRIPT',
      timeoutMs: 50,
      defaultValue: 0,
      contentHash: 'd594da1e5d99aa3d4c1f0e77b2a55c8e',
      libraries: [],
      testCases: [],
      inputs: [
        {
          id: 'ingreso_disponible',
          name: 'Ingreso disponible',
          dataType: 'DECIMAL',
          required: true,
        },
        { id: 'cuota_solicitada', name: 'Cuota solicitada', dataType: 'DECIMAL', required: true },
      ],
      sourceCode:
        '// Cuantas veces cabe la cuota en el disponible; a mas alto, mas colchon.\nconst veces = variables.ingreso_disponible / variables.cuota_solicitada;\nreturn math.min(math.round(veces * 100) / 100, 50);',
      returns: {
        dataType: 'DECIMAL',
        nullable: false,
        precision: 2,
        errorCode: 'HEADROOM_NOT_COMPUTABLE',
        constraints: { min: 0, max: 50 },
        outOfRange: 'RETURN_DEFAULT',
        missingData: 'FAIL',
        divisionByZero: 'FAIL',
        nullConditions: [],
      },
    },
  ],
};

/** El lote que devolvió el motor con `kind: OUTCOMES` sobre el artefacto sembrado. */
export const OUTCOME_BATCH = {
  kind: 'OUTCOMES',
  seed: '09piqcd',
  generatorVersion: 'atlas-qa-generator-1.2.0',
  totalOutcomes: 3,
  cases: [
    {
      index: 0,
      kind: 'OUTCOME',
      nodeKey: 'DECLINED_RESULT',
      outcome: 'Resultado: rechazada',
      path: ['START', 'COMPUTE_IDENTITY', 'DECLINE_IDENTITY_KYC_INVALID', 'DECLINED_RESULT'],
      input: { kyc_status: 'REJECTED', consent_active: false, bureau_score: 318 },
      unresolved: [],
    },
    {
      index: 1,
      kind: 'OUTCOME',
      nodeKey: 'REVIEW_RESULT',
      outcome: 'Resultado: revisión manual',
      path: ['START', 'COMPUTE_IDENTITY', 'COMPUTE_FINAL', 'REVIEW_RESULT'],
      input: { kyc_status: 'VERIFIED', consent_active: true, bureau_score: 640 },
      unresolved: ['«COND_REVIEW_NEEDED» lo calcula el grafo, no la entrada'],
    },
    {
      index: 2,
      kind: 'OUTCOME',
      nodeKey: 'APPROVED_RESULT',
      outcome: 'Resultado: aprobada',
      path: ['START', 'COMPUTE_IDENTITY', 'COMPUTE_FINAL', 'APPROVED_RESULT'],
      input: { kyc_status: 'VERIFIED', consent_active: true, bureau_score: 812 },
      unresolved: [],
    },
  ],
};

/** Lo que publica el endpoint nuevo `/v1/qa-lab/versions/:id/outcomes`. */
export const QA_OUTCOMES = {
  versionId: '274',
  items: [
    { nodeKey: 'APPROVED_RESULT', label: 'Resultado: aprobada' },
    { nodeKey: 'REVIEW_RESULT', label: 'Resultado: revisión manual' },
    { nodeKey: 'DECLINED_RESULT', label: 'Resultado: rechazada' },
  ],
};

const ENVIRONMENTS = [
  {
    id: '1',
    code: 'DEV',
    name: 'Development',
    environmentType: 'DEV',
    status: 'ACTIVE',
    isProduction: false,
    createdAt: '2026-08-02T23:37:40.068Z',
  },
];

const CONTRACT = {
  artifactCode: ARTIFACT,
  versionId: '274',
  versionNumber: 3,
  variables: [
    {
      variableCode: 'kyc_status',
      canonicalName: 'Estado KYC',
      dataType: 'STRING',
      usageType: 'INPUT',
      isRequired: true,
    },
    {
      variableCode: 'bureau_score',
      canonicalName: 'Score de buró',
      dataType: 'INTEGER',
      usageType: 'INPUT',
      isRequired: true,
    },
  ],
};

const EMPTY = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, hasNextPage: false };

/** Instala el motor simulado. Cada ruta devuelve lo que devuelve el motor de verdad. */
export async function mockDesenlacesBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', (route) => {
    const url = route.request().url();

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/environments')) return route.fulfill({ json: ENVIRONMENTS });
    if (url.includes('/v1/variables/79/dependencies')) {
      return route.fulfill({
        json: {
          total: 1,
          deployed: 1,
          items: [
            {
              artifactCode: 'BNPL_CREDIT_DECISION',
              artifactName: 'Decisión inicial de crédito',
              semanticVersion: '2.3.0',
              status: 'DEPLOYED_TO_PROD',
              usageType: 'INPUT',
              isRequired: true,
            },
          ],
        },
      });
    }
    if (url.includes('/v1/variables/79')) return route.fulfill({ json: VARIABLE_79 });
    if (url.includes('/v1/calculated-fields/80')) {
      return route.fulfill({ json: CALCULATED_FIELD_80 });
    }
    if (url.includes('/outcomes')) return route.fulfill({ json: QA_OUTCOMES });
    if (url.includes('/sample-inputs')) return route.fulfill({ json: OUTCOME_BATCH });
    if (url.includes('/v1/views/artifact-inputs')) return route.fulfill({ json: CONTRACT });
    if (url.includes('/v1/views/pickers/artifact-versions')) {
      return route.fulfill({
        json: [
          {
            id: '274',
            semanticVersion: '2.3.0',
            status: 'DEPLOYED_TO_PROD',
            artifactCode: ARTIFACT,
          },
        ],
      });
    }
    if (url.includes('/v1/views/pickers/artifacts')) {
      return route.fulfill({ json: [{ artifactCode: ARTIFACT, name: 'Decisión inicial BNPL' }] });
    }
    if (url.includes('/v1/deployments')) {
      return route.fulfill({
        json: { ...EMPTY, items: [{ isActive: true, environment: ENVIRONMENTS[0] }], total: 1 },
      });
    }
    return route.fulfill({ json: EMPTY });
  });
}
