import { asRecord, type UnknownRecord } from '../../utils/records';

/**
 * Lectura de una serie de estrés del QA Lab, para el carril sintético del monitoreo.
 *
 * Es la única aritmética de la sincronización, y vive fuera del componente porque es lo que
 * hay que poder probar: el panel sólo pinta lo que aquí se decide.
 */
export interface StressRun {
  id: string;
  startedAt: string;
  environmentCode: string;
  status: string;
  /** Casos ejecutados. Mientras la corrida vive, sólo cuenta los ya cerrados. */
  cases: number;
  failed: number;
  errored: number;
  counterexamples: number;
  durationMs: number;
  concurrency: number | null;
  checkDeterminism: boolean | null;
  /**
   * Milisegundos de motor por caso. `null` cuando no se puede dividir —corrida sin casos o
   * sin duración—: un 0 ahí se leería como «instantáneo», que es lo contrario de «no medido».
   */
  msPerCase: number | null;
  /** Casos por segundo. `null` por el mismo motivo. */
  casesPerSecond: number | null;
  /** Fracción de casos que violaron alguna propiedad. `null` sin casos: no hay denominador. */
  failureRate: number | null;
}

export interface StressSeries {
  runs: StressRun[];
  /** Corridas con casos ejecutados. Una serie vacía no se resume, se declara vacía. */
  measured: number;
  totalCases: number;
  totalFailed: number;
  /** Fallo agregado de la serie. `null` si no se ejecutó ni un caso. */
  failureRate: number | null;
  /**
   * Degradación bajo carga dentro de la COHORTE comparable más poblada: cuánto se encareció el
   * caso entre su corrida más ligera y la más pesada. `null` cuando ninguna configuración
   * reúne dos corridas de distinto tamaño — que es lo normal hasta que alguien lanza una serie
   * a propósito.
   */
  degradation: {
    lightest: StressRun;
    heaviest: StressRun;
    /** Cuántas veces más caro sale un caso en la corrida pesada. 1 = igual. */
    factor: number;
    /** Cuántas corridas comparte la cohorte medida, incluidas las dos de los extremos. */
    cohort: number;
  } | null;
}

/** Una fila del listado `/v1/qa-lab/runs` a la lectura de estrés. */
function toRun(row: UnknownRecord): StressRun {
  const cases = numberOf(row.totalCases) ?? 0;
  const durationMs = numberOf(row.durationMs) ?? 0;
  const failed = numberOf(row.failedCases) ?? 0;
  const concurrency = numberOf(row.concurrency);
  const checkDeterminism = typeof row.checkDeterminism === 'boolean' ? row.checkDeterminism : null;
  const divisible = cases > 0 && durationMs > 0;

  return {
    id: String(row.id ?? ''),
    startedAt: String(row.startedAt ?? ''),
    environmentCode: String(row.environmentCode ?? ''),
    status: String(row.status ?? ''),
    cases,
    failed,
    errored: numberOf(row.erroredCases) ?? 0,
    counterexamples: numberOf(row.counterexamples) ?? 0,
    durationMs,
    concurrency,
    checkDeterminism,
    msPerCase: divisible ? durationMs / cases : null,
    casesPerSecond: divisible ? cases / (durationMs / 1000) : null,
    failureRate: cases > 0 ? failed / cases : null,
  };
}

/**
 * Resume las corridas de una versión como una serie de estrés.
 *
 * Las corridas llegan de la más nueva a la más vieja y así se enseñan; la comparación de
 * carga, en cambio, se hace por número de casos, que es lo que define la presión.
 */
export function readStressSeries(rows: UnknownRecord[]): StressSeries {
  const parsed = rows.map((row) => toRun(asRecord(row)));
  const measured = parsed.filter((run) => run.cases > 0);
  const totalCases = measured.reduce((sum, run) => sum + run.cases, 0);
  const totalFailed = measured.reduce((sum, run) => sum + run.failed, 0);

  return {
    runs: parsed,
    measured: measured.length,
    totalCases,
    totalFailed,
    failureRate: totalCases > 0 ? totalFailed / totalCases : null,
    degradation: degradationOf(measured),
  };
}

/**
 * Compara la corrida más ligera con la más pesada DENTRO de una misma configuración.
 *
 * Dos corridas con distinta concurrencia —o una con determinismo y otra sin él— dan un factor
 * que no dice nada del motor: dice que se configuraron distinto. Devolver ese número
 * igualmente sería la peor salida, porque es exactamente el que alguien citaría en una
 * reunión.
 *
 * Por eso NO se comparan los extremos de la lista, que es lo primero que se le ocurre a
 * cualquiera: en un historial real conviven tandas viejas configuradas de otra manera, y los
 * extremos casi nunca son comparables entre sí. Se agrupa por configuración y se mide la
 * cohorte más poblada —a igualdad, la de mayor recorrido de carga—, que es la serie que
 * alguien lanzó a propósito.
 *
 * Una corrida sin carga archivada queda FUERA de toda cohorte: no se sabe cómo corrió, y
 * agruparla con las que declaran su configuración sería suponérsela.
 */
function degradationOf(runs: StressRun[]): StressSeries['degradation'] {
  const cohortes = new Map<string, StressRun[]>();
  for (const run of runs) {
    if (run.msPerCase === null || run.concurrency === null) continue;
    const clave = `${run.concurrency}|${run.checkDeterminism}`;
    cohortes.set(clave, [...(cohortes.get(clave) ?? []), run]);
  }

  let mejor: { lightest: StressRun; heaviest: StressRun; cohort: number } | null = null;
  for (const cohorte of cohortes.values()) {
    const porCarga = [...cohorte].sort((a, b) => a.cases - b.cases);
    const lightest = porCarga[0];
    const heaviest = porCarga[porCarga.length - 1];
    // Sin recorrido de carga no hay nada que medir: la diferencia entre dos tandas del mismo
    // tamaño es ruido de máquina, no degradación.
    if (lightest.cases === heaviest.cases) continue;
    const candidata = { lightest, heaviest, cohort: cohorte.length };
    const gana =
      mejor === null ||
      candidata.cohort > mejor.cohort ||
      (candidata.cohort === mejor.cohort &&
        heaviest.cases - lightest.cases > mejor.heaviest.cases - mejor.lightest.cases);
    if (gana) mejor = candidata;
  }

  if (mejor === null) return null;
  return { ...mejor, factor: mejor.heaviest.msPerCase! / mejor.lightest.msPerCase! };
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Milisegundos legibles. `null` sale como «—»: no medido no es cero. */
export function asMs(value: number | null): string {
  if (value === null) return '—';
  return value >= 100 ? `${Math.round(value)} ms` : `${value.toFixed(2)} ms`;
}

/** Caudal legible. */
export function asThroughput(value: number | null): string {
  if (value === null) return '—';
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} casos/s`;
}
