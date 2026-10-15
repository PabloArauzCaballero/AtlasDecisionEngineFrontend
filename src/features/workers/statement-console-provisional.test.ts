import { describe, expect, it } from 'vitest';
import { consoleOutcome, displayableResult, hasMovements } from './statement-console-outcome';
import type { WorkerRun } from './worker-types';

/** 2026-10-15: la consola enseña lo leído de un extracto detenido por la entidad, marcado como provisional. */
describe('consola de extractos · análisis provisional', () => {
  const detenido = {
    requestId: 'bs-1',
    status: 'PENDING_REVIEW',
    reviewReason: 'UNKNOWN_BANK',
    provisionalResult: { transactions: [{ index: 1 }, { index: 2 }] },
  } as unknown as WorkerRun;

  it('pinta el provisional cuando no hay resultado, y el resultado cuando lo hay', () => {
    expect(displayableResult(detenido)).toBe(detenido.provisionalResult);
    const conResultado = { ...detenido, result: { transactions: [] } } as WorkerRun;
    expect(displayableResult(conResultado)).toBe(conResultado.result);
  });

  it('cuenta sus movimientos y lo anuncia como análisis provisional', () => {
    expect(hasMovements(detenido)).toBe(true);
    expect(consoleOutcome(detenido, false)?.body).toMatch(/análisis provisional/);
  });
});
