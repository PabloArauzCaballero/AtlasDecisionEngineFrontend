import { describe, expect, it } from 'vitest';
import { asMs, asThroughput, readStressSeries } from './qa-stress';

/**
 * La aritmética del carril sintético.
 *
 * Cada caso de aquí es una forma de mentir con estos números: dividir por cero y llamarlo
 * «instantáneo», comparar dos corridas configuradas distinto y llamarlo «degradación», o dar
 * una tasa de fallo sin denominador. Las tres producen una pantalla que suena a medición.
 */
function corrida(over: Record<string, unknown> = {}) {
  return {
    id: '1',
    startedAt: '2026-08-15T10:00:00.000Z',
    environmentCode: 'UAT',
    status: 'COMPLETED',
    totalCases: 100,
    failedCases: 0,
    erroredCases: 0,
    counterexamples: 0,
    durationMs: 1000,
    concurrency: 1,
    checkDeterminism: false,
    ...over,
  };
}

describe('readStressSeries', () => {
  it('deriva coste por caso, caudal y tasa de fallo con su denominador', () => {
    const serie = readStressSeries([
      corrida({ totalCases: 200, durationMs: 4000, failedCases: 10 }),
    ]);

    expect(serie.runs[0].msPerCase).toBe(20);
    expect(serie.runs[0].casesPerSecond).toBe(50);
    expect(serie.runs[0].failureRate).toBe(0.05);
    expect(serie.totalCases).toBe(200);
    expect(serie.totalFailed).toBe(10);
    expect(serie.failureRate).toBe(0.05);
  });

  it('una corrida sin casos no vale 0 ms por caso: vale «no medido»', () => {
    // Es la corrida que se cortó o la que acaba de arrancar. Un 0 la pintaría como la más
    // rápida de la serie, que es justo la lectura contraria.
    const serie = readStressSeries([corrida({ totalCases: 0, durationMs: 0 })]);

    expect(serie.runs[0].msPerCase).toBeNull();
    expect(serie.runs[0].casesPerSecond).toBeNull();
    expect(serie.runs[0].failureRate).toBeNull();
    expect(serie.measured).toBe(0);
    expect(serie.failureRate).toBeNull();
    expect(serie.degradation).toBeNull();
  });

  it('mide la degradación entre la corrida más ligera y la más pesada', () => {
    const serie = readStressSeries([
      corrida({ id: '3', totalCases: 4000, durationMs: 40_000 }),
      corrida({ id: '2', totalCases: 1000, durationMs: 5000 }),
      corrida({ id: '1', totalCases: 200, durationMs: 1000 }),
    ]);

    // 5 ms/caso con 200 casos → 10 ms/caso con 4000. El doble de caro bajo veinte veces la carga.
    expect(serie.degradation?.lightest.cases).toBe(200);
    expect(serie.degradation?.heaviest.cases).toBe(4000);
    expect(serie.degradation?.factor).toBe(2);
    expect(serie.degradation?.cohort).toBe(3);
  });

  it('en un historial mixto mide la cohorte comparable, no los extremos de la lista', () => {
    /*
     * El caso real: sobre una versión viva conviven tandas viejas configuradas de otra manera.
     * Comparar la más ligera con la más pesada de TODA la lista casi nunca compara dos corridas
     * comparables, así que la lectura desaparecería justo en las versiones más trabajadas —o,
     * peor, saldría un factor que mide la configuración—.
     */
    const serie = readStressSeries([
      corrida({ id: '5', totalCases: 5000, durationMs: 20_000, concurrency: 8 }),
      corrida({ id: '4', totalCases: 3000, durationMs: 30_000, concurrency: 1 }),
      corrida({ id: '3', totalCases: 1200, durationMs: 9600, concurrency: 1 }),
      corrida({ id: '2', totalCases: 300, durationMs: 1800, concurrency: 1 }),
      corrida({ id: '1', totalCases: 50, durationMs: 100, concurrency: 4 }),
    ]);

    // La cohorte de concurrencia 1 tiene tres corridas: 6 ms/caso → 10 ms/caso.
    expect(serie.degradation?.cohort).toBe(3);
    expect(serie.degradation?.lightest.cases).toBe(300);
    expect(serie.degradation?.heaviest.cases).toBe(3000);
    expect(serie.degradation?.lightest.concurrency).toBe(1);
  });

  it('NO compara dos corridas con distinta concurrencia', () => {
    /*
     * El fallo que este caso impide es silencioso y caro: con concurrencia 1 el motor despacha
     * de uno en uno y con 8 en paralelo, así que el ms/caso puede diferir en un orden de
     * magnitud sin que el motor se haya degradado nada. El número saldría igual de convincente
     * en pantalla, y es el que alguien citaría para decidir capacidad.
     */
    const serie = readStressSeries([
      corrida({ id: '2', totalCases: 4000, durationMs: 40_000, concurrency: 8 }),
      corrida({ id: '1', totalCases: 200, durationMs: 1000, concurrency: 1 }),
    ]);

    expect(serie.measured).toBe(2);
    expect(serie.degradation).toBeNull();
  });

  it('tampoco compara si una comprobó determinismo y la otra no', () => {
    // Con determinismo cada caso se ejecuta DOS veces: el doble de trabajo por el mismo caso.
    const serie = readStressSeries([
      corrida({ id: '2', totalCases: 4000, durationMs: 40_000, checkDeterminism: true }),
      corrida({ id: '1', totalCases: 200, durationMs: 1000, checkDeterminism: false }),
    ]);

    expect(serie.degradation).toBeNull();
  });

  it('una corrida sin configuración archivada no hereda la de serie', () => {
    // Las corridas anteriores a que el motor publicara la carga llegan sin ella. Suponerles la
    // concurrencia por omisión inventaría una medición que nadie tomó.
    const serie = readStressSeries([
      corrida({ id: '2', totalCases: 4000, durationMs: 40_000, concurrency: null }),
      corrida({ id: '1', totalCases: 200, durationMs: 1000, concurrency: 1 }),
    ]);

    expect(serie.runs[0].concurrency).toBeNull();
    expect(serie.degradation).toBeNull();
  });

  it('no compara una corrida consigo misma', () => {
    const serie = readStressSeries([
      corrida({ id: '2', totalCases: 200, durationMs: 3000 }),
      corrida({ id: '1', totalCases: 200, durationMs: 1000 }),
    ]);

    // Mismo tamaño: la diferencia es ruido de máquina, no degradación bajo carga.
    expect(serie.degradation).toBeNull();
  });

  it('sin corridas, la serie está vacía y no resume nada', () => {
    const serie = readStressSeries([]);

    expect(serie.runs).toEqual([]);
    expect(serie.failureRate).toBeNull();
    expect(serie.degradation).toBeNull();
  });
});

describe('formato', () => {
  it('distingue «no medido» de cero', () => {
    expect(asMs(null)).toBe('—');
    expect(asThroughput(null)).toBe('—');
    expect(asMs(0.5)).toBe('0.50 ms');
    expect(asMs(1234.6)).toBe('1235 ms');
    expect(asThroughput(12.34)).toBe('12.3 casos/s');
    expect(asThroughput(1200)).toBe('1200 casos/s');
  });
});
