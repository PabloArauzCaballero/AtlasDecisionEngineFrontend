import { durationLabel, runTimings } from './worker-metrics';
import type { WorkerRun, WorkerRunStatus } from './worker-types';

/** Fila mínima con el ciclo de vida que el gráfico mide. */
function run(partial: Partial<WorkerRun> & { status: WorkerRunStatus }): WorkerRun {
  return {
    requestId: partial.requestId ?? `run-${partial.status}`,
    progress: 100,
    inputSource: 'FIXTURE',
    attemptCount: 1,
    queuedAt: '2026-08-06T10:00:00.000Z',
    requestedBy: 'pablo@atlas',
    correlationId: 'corr-1',
    errorCode: null,
    errorMessage: null,
    ...partial,
  };
}

describe('tiempos de cada ejecución', () => {
  it('mide el proceso y la espera por separado', () => {
    const [timing] = runTimings([
      run({
        status: 'SUCCEEDED',
        startedAt: '2026-08-06T10:00:01.000Z',
        finishedAt: '2026-08-06T10:00:03.500Z',
      }),
    ]);

    // Si se sumaran, no se sabría cuál de los dos crece, y son dos problemas
    // distintos: falta capacidad, o el trabajo se encareció.
    expect(timing.waitMs).toBe(1_000);
    expect(timing.durationMs).toBe(2_500);
  });

  it('invierte el orden del motor para que el tiempo avance a la derecha', () => {
    const timings = runTimings([
      run({ requestId: 'nueva', status: 'SUCCEEDED', queuedAt: '2026-08-06T12:00:00.000Z' }),
      run({ requestId: 'vieja', status: 'SUCCEEDED', queuedAt: '2026-08-06T10:00:00.000Z' }),
    ]);

    // El motor sirve la más reciente primero, que es lo que quiere una lista.
    // Sin invertir, una degradación se dibujaría como una mejora.
    expect(timings.map((timing) => timing.run.requestId)).toEqual(['vieja', 'nueva']);
  });

  it('una ejecución que no ha terminado no inventa una duración', () => {
    const [timing] = runTimings([
      run({ status: 'RUNNING', startedAt: '2026-08-06T10:00:01.000Z', finishedAt: null }),
    ]);

    expect(timing.durationMs).toBeNull();
    expect(timing.waitMs).toBe(1_000);
  });

  it('nunca devuelve una duración negativa', () => {
    // Los relojes del navegador y del servidor no coinciden.
    const [timing] = runTimings([
      run({
        status: 'SUCCEEDED',
        queuedAt: '2026-08-06T10:00:10.000Z',
        startedAt: '2026-08-06T10:00:00.000Z',
      }),
    ]);

    expect(timing.waitMs).toBe(0);
  });
});

describe('durationLabel', () => {
  it('cambia de unidad con la magnitud', () => {
    expect(durationLabel(174)).toBe('174 ms');
    expect(durationLabel(2_450)).toBe('2.5 s');
    expect(durationLabel(31_200)).toBe('31 s');
    expect(durationLabel(125_000)).toBe('2 min 5 s');
  });

  it('un hueco se dibuja como hueco, no como cero', () => {
    expect(durationLabel(null)).toBe('—');
    expect(durationLabel(undefined)).toBe('—');
  });
});
