import { describe, expect, it } from 'vitest';
import { edgeRuntimeAt, normalizeTrace, runtimeAt } from './execution-trace';

const EXECUTION = {
  traceSteps: [
    { nodeKey: 'INICIO', nodeType: 'START', status: 'COMPLETED', durationUs: 1200 },
    {
      nodeKey: 'VALIDA',
      nodeType: 'CONDITION',
      status: 'COMPLETED',
      branchTaken: 'e-si',
      discardedEdgeKeys: ['e-no'],
      durationMs: 8,
    },
    {
      nodeKey: 'RIESGO',
      nodeType: 'SCORE',
      status: 'FAILED',
      errorMessage: 'La variable score_base no llegó',
    },
  ],
};

const NODES = ['INICIO', 'VALIDA', 'RIESGO', 'RESULTADO'];
const EDGES = [
  { key: 'e-inicio', from: 'INICIO', to: 'VALIDA' },
  { key: 'e-si', from: 'VALIDA', to: 'RIESGO' },
  { key: 'e-no', from: 'VALIDA', to: 'RESULTADO' },
  { key: 'e-fin', from: 'RIESGO', to: 'RESULTADO' },
];

describe('normalizeTrace', () => {
  it('traduce los estados del motor y normaliza la duración a milisegundos', () => {
    const steps = normalizeTrace(EXECUTION);

    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatchObject({ nodeKey: 'INICIO', status: 'done', durationMs: 1 });
    expect(steps[1]).toMatchObject({ status: 'done', branchTaken: 'e-si', durationMs: 8 });
    expect(steps[1].discardedEdgeKeys).toEqual(['e-no']);
  });

  it('marca como error un paso con mensaje de error aunque no traiga estado', () => {
    const steps = normalizeTrace({ trace: [{ nodeKey: 'X', error: 'timeout' }] });

    expect(steps[0].status).toBe('error');
    expect(steps[0].error).toBe('timeout');
  });

  it('devuelve una lista vacía cuando la ejecución no registró traza', () => {
    expect(normalizeTrace({ status: 'COMPLETED' })).toEqual([]);
    expect(normalizeTrace(null)).toEqual([]);
  });
});

describe('runtimeAt', () => {
  const steps = normalizeTrace(EXECUTION);

  it('pinta el paso actual en ejecución y los siguientes como pendientes', () => {
    const runtime = runtimeAt(steps, 1, NODES);

    expect(runtime.INICIO.status).toBe('done');
    expect(runtime.VALIDA.status).toBe('running');
    expect(runtime.RIESGO.status).toBe('pending');
    expect(runtime.RESULTADO.status).toBe('pending');
  });

  it('respeta el desenlace real en el cursor cuando el paso terminó en error', () => {
    const runtime = runtimeAt(steps, 2, NODES);

    expect(runtime.RIESGO.status).toBe('error');
    expect(runtime.RIESGO.error).toBe('La variable score_base no llegó');
  });

  it('sólo marca omitidos los nodos nunca ejecutados al llegar al final', () => {
    expect(runtimeAt(steps, 0, NODES).RESULTADO.status).toBe('pending');
    expect(runtimeAt(steps, 2, NODES).RESULTADO.status).toBe('skipped');
  });
});

describe('edgeRuntimeAt', () => {
  const steps = normalizeTrace(EXECUTION);

  it('marca recorridas las aristas entre pasos consecutivos de la traza', () => {
    const edges = edgeRuntimeAt(steps, 2, EDGES);

    expect(edges['e-inicio']).toBe('taken');
    expect(edges['e-si']).toBe('taken');
  });

  it('marca descartadas las salidas evaluadas que no se tomaron', () => {
    expect(edgeRuntimeAt(steps, 2, EDGES)['e-no']).toBe('discarded');
  });

  it('deja sin evaluar las aristas que la reproducción todavía no alcanzó', () => {
    expect(edgeRuntimeAt(steps, 0, EDGES)['e-si']).toBe('pending');
    expect(edgeRuntimeAt(steps, 0, EDGES)['e-fin']).toBe('pending');
  });
});
