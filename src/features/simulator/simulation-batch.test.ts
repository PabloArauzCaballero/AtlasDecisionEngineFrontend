import { ApiError } from '../../api/ApiError';
import type { SimulationResponse } from '../../testing/testing.schemas';
import { batchCases, batchSummary, runSimulationBatch, type BatchEntry } from './simulation-batch';

const decision = (outcome: string) => ({ outcome }) as unknown as SimulationResponse;

describe('qué casos se ejecutan', () => {
  it('cae al payload del formulario cuando no hay tanda', () => {
    expect(batchCases([], { b: 2 })).toEqual([{ label: 'Caso actual', input: { b: 2 } }]);
  });

  it('el caso que el formulario edita viaja con lo que hay escrito AHORA', () => {
    const cases = [
      { label: 'Caso 1', input: { cuota: 100 } },
      { label: 'Caso 2', input: { cuota: 200 } },
    ];

    // Se devolvía la tanda tal cual, así que cualquier cambio hecho a mano tras
    // generarla o subir un archivo se descartaba: el motor contestaba «falta la
    // variable X» sobre un formulario que la enseñaba rellena.
    expect(batchCases(cases, { cuota: 150000, pdf: 'JVBERi0=' }, 0)).toEqual([
      { label: 'Caso 1', input: { cuota: 150000, pdf: 'JVBERi0=' } },
      { label: 'Caso 2', input: { cuota: 200 } },
    ]);
  });

  it('editar un caso no reescribe los demás', () => {
    const cases = [
      { label: 'Caso 1', input: { cuota: 100 } },
      { label: 'Caso 2', input: { cuota: 200 } },
    ];

    const ejecutados = batchCases(cases, { cuota: 999 }, 1);

    expect(ejecutados[0].input).toEqual({ cuota: 100 });
    expect(ejecutados[1].input).toEqual({ cuota: 999 });
  });
});

describe('ejecución de la tanda', () => {
  const cases = [
    { label: 'Caso 1', input: { score: 700 } },
    { label: 'Caso 2', input: { score: 400 } },
  ];

  it('devuelve un resultado por caso, conservando su etiqueta y su entrada', async () => {
    const entries = await runSimulationBatch(cases, (input) =>
      Promise.resolve(decision(Number(input.score) > 500 ? 'APPROVED' : 'DECLINED')),
    );
    expect(entries.map((entry) => entry.label)).toEqual(['Caso 1', 'Caso 2']);
    expect(entries.map((entry) => entry.decision?.outcome)).toEqual(['APPROVED', 'DECLINED']);
    expect(entries[1].input).toEqual({ score: 400 });
  });

  it('un caso que falla no corta la tanda: los demás siguen decidiéndose', async () => {
    const entries = await runSimulationBatch(cases, (input) =>
      Number(input.score) === 400
        ? Promise.reject(new ApiError('Variable inválida', 422))
        : Promise.resolve(decision('APPROVED')),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].decision?.outcome).toBe('APPROVED');
    expect(entries[1].decision).toBeUndefined();
    expect(entries[1].error).toBe('Variable inválida');
  });

  it('las ejecuta en serie, no en paralelo', async () => {
    const orden: string[] = [];
    await runSimulationBatch(cases, async (input) => {
      orden.push(`inicio ${input.score}`);
      await Promise.resolve();
      orden.push(`fin ${input.score}`);
      return decision('APPROVED');
    });
    expect(orden).toEqual(['inicio 700', 'fin 700', 'inicio 400', 'fin 400']);
  });
});

describe('resumen de la tanda', () => {
  const entry = (outcome?: string, error?: string): BatchEntry => ({
    label: 'x',
    input: {},
    decision: outcome ? decision(outcome) : undefined,
    error,
  });

  it('cuenta los desenlaces y los errores por separado', () => {
    expect(
      batchSummary([
        entry('APPROVED'),
        entry('APPROVED'),
        entry('DECLINED'),
        entry(undefined, 'x'),
      ]),
    ).toBe('2 APPROVED · 1 DECLINED · 1 con error');
  });

  it('calla cuando hay un solo caso: no hay nada que resumir', () => {
    expect(batchSummary([entry('APPROVED')])).toBe('');
    expect(batchSummary([])).toBe('');
  });
});
