import { describe, expect, it } from 'vitest';
import { sensitiveCodesOfExecution } from '../../utils/sensitivity';
import { normalizeTrace } from './execution-trace';
import { flattenExecution } from './execution-record';
import contract from '../../contracts/fixtures/audit-execution.example.json';

/**
 * Copia de `docs/contracts/audit-execution.example.json` del motor. Allí se tipa
 * contra la fila real de Prisma: si el motor cambia la forma, cambia ese JSON y
 * esta copia deja de coincidir. NO se edita a mano: se vuelve a copiar.
 */
const AUDIT_ROW = contract as Record<string, unknown>;

describe('flattenExecution', () => {
  const execution = flattenExecution(AUDIT_ROW);

  it('sube artefacto, versión, ambiente, estado y entrada desde las relaciones', () => {
    expect(execution).toMatchObject({
      artifactCode: 'SCORING_CONTRATO',
      versionNumber: 3,
      environmentCode: 'SANDBOX',
      status: 'SUCCEEDED',
      outcome: 'APPROVED',
      inputJson: { country: 'BO', monthly_income: 5200, document_number: '0000000' },
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
    const [, step] = execution.traceSteps as Array<Record<string, unknown>>;
    expect(step).toMatchObject({ nodeKey: 'RIESGO', variableState: { nodeKey: 'RIESGO' } });
    expect(normalizeTrace(execution).map((item) => item.nodeKey)).toEqual([
      'INICIO',
      'RIESGO',
      'VERIFICAR_IDENTIDAD',
    ]);
    expect(normalizeTrace(execution)[1]).toMatchObject({ nodeType: 'SCORE', durationMs: 2 });
  });
});
