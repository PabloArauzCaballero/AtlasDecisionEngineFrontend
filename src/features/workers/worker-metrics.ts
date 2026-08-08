import type { WorkerRun } from './worker-types';

/**
 * Lo poco que sobre las métricas sigue calculándose en el cliente.
 *
 * La salud, la latencia agregada, la cola y las incidencias las publica el
 * motor en `GET /v1/workers/:code/metrics`, calculadas sobre la ventana entera
 * en la base. Aquí ya no se replica nada de eso: dos implementaciones de la
 * misma aritmética son dos oportunidades de que dos pantallas den cifras
 * distintas del mismo worker, y la de aquí además sólo veía la página que le
 * cupo.
 *
 * Lo que queda es lo que el agregado no puede dar por definición: **la duración
 * de CADA ejecución**, que es lo que dibuja el gráfico de barras. Un percentil
 * no se puede desagregar en las muestras que lo produjeron.
 */

/** Una ejecución terminada, con sus dos tiempos medidos. */
export interface RunTiming {
  run: WorkerRun;
  /** Espera en cola, en ms. `null` si nunca la tomó un worker. */
  waitMs: number | null;
  /** Proceso real, en ms. `null` si no llegó a terminar. */
  durationMs: number | null;
}

function millisBetween(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

/**
 * Tiempos de cada ejecución, **de la más antigua a la más reciente**.
 *
 * El motor las sirve al revés (la última primero, que es lo que quiere una
 * lista) y un gráfico las quiere en orden cronológico: si no se invierte, la
 * tendencia se lee al revés y una degradación parece una mejora.
 */
export function runTimings(runs: readonly WorkerRun[]): RunTiming[] {
  return runs
    .map((run) => ({
      run,
      waitMs: millisBetween(run.queuedAt, run.startedAt),
      durationMs: millisBetween(run.startedAt, run.finishedAt),
    }))
    .reverse();
}

/**
 * Duración legible con la precisión que corresponde a su magnitud.
 *
 * Un «1.842 ms» y un «31 s» dicen lo mismo, pero sólo el segundo se lee de un
 * vistazo cuando lo que se compara son barras en un gráfico.
 */
export function durationLabel(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes} min ${Math.round((ms % 60_000) / 1_000)} s`;
}
