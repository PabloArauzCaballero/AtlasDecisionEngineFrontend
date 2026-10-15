import { describe, expect, it } from 'vitest';
import { consoleOutcome, hasMovements } from './statement-console-outcome';
import type { WorkerRun } from './worker-types';

const base: WorkerRun = {
  requestId: 'bs-1',
  status: 'QUEUED',
  progress: 0,
  inputSource: 'UPLOAD',
  attemptCount: 1,
  queuedAt: '2026-10-07T22:26:15Z',
  requestedBy: 'analista',
  correlationId: 'c',
};

describe('consoleOutcome · la consola dice qué pasó con el PDF', () => {
  it('un PDF repetido en revisión por entidad desconocida lo dice y enlaza a revisión y entidades', () => {
    const r = consoleOutcome({ ...base, status: 'IN_REVIEW', reviewReason: 'UNKNOWN_BANK' }, true);
    expect(r?.title).toMatch(/no se reconoció la entidad/);
    expect(r?.body).toMatch(/ya estaba en el motor/);
    expect(r?.links.map((l) => l.href)).toEqual([
      '/workers/bank-statement?vista=revision',
      '/workers/bank-statement?vista=entidades',
    ]);
  });

  it('cerrado sin movimientos no se queda en blanco', () => {
    const r = consoleOutcome({ ...base, status: 'SUCCEEDED_WITH_WARNINGS', result: null }, false);
    expect(r?.title).toBe('Terminó sin movimientos');
  });

  it('con movimientos y sin repetir no añade nada', () => {
    const run = {
      ...base,
      status: 'SUCCEEDED' as const,
      result: { transactions: [{ description: 'x' }] },
    };
    expect(hasMovements(run)).toBe(true);
    expect(consoleOutcome(run, false)).toBeNull();
  });

  it('en cola o leyendo no añade nada', () => {
    expect(consoleOutcome({ ...base, status: 'RUNNING' }, false)).toBeNull();
  });
});
