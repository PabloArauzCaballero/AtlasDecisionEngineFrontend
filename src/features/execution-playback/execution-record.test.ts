import { describe, expect, it } from 'vitest';
import { sensitiveCodesOfExecution } from '../../utils/sensitivity';
import { normalizeTrace } from './execution-trace';
import { flattenExecution } from './execution-record';

/** Forma real de `GET /v1/audit/executions/:id` (relaciones de Prisma, BigInt como texto). */
const AUDIT_ROW = {
  id: '103',
  decisionStatus: 'SUCCEEDED',
  businessOutcome: 'APPROVED',
  inputSnapshotJson: { monthly_income: 5200 },
  artifactVersion: { versionNumber: 3, artifact: { artifactCode: 'SCORING' } },
  deployment: { environment: { code: 'PROD' } },
  variables: [
    {
      id: '1',
      valueJson: 'BO',
      sourceCode: 'REQUEST',
      variableVersion: {
        definition: { variableCode: 'country', isSensitive: false, sensitivityClass: 'INTERNAL' },
      },
    },
    {
      id: '2',
      valueJson: '1234567',
      sourceCode: 'REQUEST',
      variableVersion: {
        definition: { variableCode: 'document_number', isSensitive: true, sensitivityClass: 'PII' },
      },
    },
  ],
  steps: [
    {
      nodeId: '55',
      durationUs: '2400',
      evaluationResultJson: { score: 640, variableState: { nodeKey: 'RIESGO', inputs: [] } },
      node: { nodeKey: 'RIESGO', nodeType: 'SCORE' },
    },
  ],
};

describe('flattenExecution', () => {
  const execution = flattenExecution(AUDIT_ROW);

  it('sube artefacto, versión, ambiente, estado y entrada desde las relaciones', () => {
    expect(execution).toMatchObject({
      artifactCode: 'SCORING',
      versionNumber: 3,
      environmentCode: 'PROD',
      status: 'SUCCEEDED',
      outcome: 'APPROVED',
      inputJson: { monthly_income: 5200 },
    });
  });

  it('da nombre y origen a cada variable resuelta', () => {
    expect(execution.variables).toEqual([
      expect.objectContaining({ variableCode: 'country', sourceType: 'REQUEST' }),
      expect.objectContaining({ variableCode: 'document_number', sensitivityClass: 'PII' }),
    ]);
  });

  it('reconoce como sensible la variable que el catálogo marcó así', () => {
    expect([...sensitiveCodesOfExecution(execution)]).toEqual(['document_number']);
  });

  it('expone el estado de variables del nodo y su clave para el panel por nodo', () => {
    const [step] = execution.traceSteps as Array<Record<string, unknown>>;
    expect(step).toMatchObject({ nodeKey: 'RIESGO', variableState: { nodeKey: 'RIESGO' } });
    expect(normalizeTrace(execution)[0]).toMatchObject({ nodeKey: 'RIESGO', durationMs: 2 });
  });
});
