'use client';

import { RefreshCw } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { Alert } from '../../components/Alert';
import { Panel } from '../../components/Panel';
import { useWorkerMetrics, useWorkerRuns, WORKER_WINDOW_HOURS } from './useWorkerRuns';
import { durationLabel, runTimings } from './worker-metrics';
import { STATUS_LABEL, type WorkerDescriptor, type WorkerMetrics } from './worker-types';
import { WorkerIncidentsPanel } from './WorkerIncidentsPanel';
import { WorkerLatencyChart } from './WorkerLatencyChart';
import { WorkerQueuePanel } from './WorkerQueuePanel';
import { WorkerVitals } from './WorkerVitals';
import type { WorkerCode } from './workers.api';

interface WorkerDashboardProps {
  worker: WorkerCode;
  descriptor?: WorkerDescriptor;
  catalogLoading: boolean;
  /** La pestaña oculta no sondea: el panel de un worker que nadie mira, tampoco. */
  active: boolean;
}

/**
 * Panel de control de un worker: salud, latencia, cola e incidencias.
 *
 * Las cifras las calcula el motor sobre la ventana entera
 * (`GET /v1/workers/:code/metrics`); esta vista no las deriva. Lo único que
 * sigue pidiendo por su cuenta son las últimas ejecuciones, y sólo para dibujar
 * una barra por cada una: un percentil no se puede desagregar en las muestras
 * que lo produjeron.
 */
export function WorkerDashboard({
  worker,
  descriptor,
  catalogLoading,
  active,
}: WorkerDashboardProps) {
  const health = useWorkerMetrics(worker, active);
  const runs = useWorkerRuns(worker, active);
  const metrics = health.data;
  // `isPending` y no `isFetching`: un refresco silencioso de fondo no debe
  // vaciar un panel que ya tiene cifras buenas en pantalla.
  const loading = health.isPending && !health.isError;

  const dias = Math.round(WORKER_WINDOW_HOURS / 24);
  const ventana = metrics ? `${metrics.totalRuns} ejecuciones · ${dias} días` : 'consultando…';
  const timings = runTimings(runs.data?.items ?? []);

  return (
    <div className="worker-dashboard">
      {health.isError ? (
        <Alert tone="error">
          No se pudo leer la salud del worker: {errorMessage(health.error)}
        </Alert>
      ) : null}

      <WorkerVitals
        descriptor={descriptor}
        metrics={metrics}
        catalogLoading={catalogLoading}
        metricsLoading={loading}
      />

      <div className="worker-dashboard-grid">
        <Panel
          title="Latencia"
          meta={timings.length ? `últimas ${timings.length} ejecuciones` : ventana}
          className="worker-panel-latency"
        >
          {loading && !timings.length ? (
            <p className="worker-chart-empty">Consultando las duraciones de cada ejecución…</p>
          ) : (
            <WorkerLatencyChart
              timings={timings}
              p50Ms={metrics?.latency.p50Ms ?? null}
              p95Ms={metrics?.latency.p95Ms ?? null}
            />
          )}
          <dl className="worker-latency-facts">
            <div>
              <dt>Mediana</dt>
              <dd>{durationLabel(metrics?.latency.p50Ms)}</dd>
            </div>
            <div>
              <dt>Percentil 95</dt>
              <dd>{durationLabel(metrics?.latency.p95Ms)}</dd>
            </div>
            <div>
              <dt>La más lenta</dt>
              <dd>{durationLabel(metrics?.latency.maxMs)}</dd>
            </div>
            <div>
              <dt>Espera en cola</dt>
              <dd>{durationLabel(metrics?.latency.avgWaitMs)}</dd>
            </div>
          </dl>
          <p className="worker-panel-note">
            {metrics
              ? `Las cifras salen de ${metrics.latency.samples} ejecuciones terminadas en ${dias} días; el gráfico dibuja sólo las últimas. `
              : ''}
            Se mide el proceso (de que un worker la toma a que termina) aparte de la espera: si lo
            que crece es la espera, sobra cola; si lo que crece es el proceso, el trabajo se está
            volviendo más caro.
          </p>
        </Panel>

        <Panel title="Reparto por estado" meta={ventana} className="worker-panel-mix">
          {loading ? (
            <p className="worker-chart-empty">Consultando el historial de ejecuciones…</p>
          ) : metrics?.statusMix.length ? (
            <>
              <div className="worker-mix-bar" role="img" aria-label={mixLabel(metrics)}>
                {metrics.statusMix.map((slice) => (
                  <span
                    key={slice.status}
                    className={`worker-mix-slice is-${slice.status.toLowerCase()}`}
                    style={{ flexGrow: slice.count }}
                  />
                ))}
              </div>
              <ul className="worker-mix-legend">
                {metrics.statusMix.map((slice) => (
                  <li key={slice.status}>
                    <span
                      className={`worker-mix-key is-${slice.status.toLowerCase()}`}
                      aria-hidden="true"
                    />
                    {STATUS_LABEL[slice.status]}
                    <strong>{slice.count}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="worker-chart-empty">
              Este worker no ha procesado nada en los últimos {dias} días.
            </p>
          )}
        </Panel>
      </div>

      <Panel
        title="Procesos encolados"
        meta={
          loading || !metrics
            ? 'consultando…'
            : `${metrics.queue.running} en proceso · ${metrics.queue.queued} esperando`
        }
        className="worker-panel-queue"
      >
        {loading || !metrics ? (
          <p className="worker-chart-empty">Consultando la cola del worker…</p>
        ) : (
          <WorkerQueuePanel queue={metrics.queue} />
        )}
      </Panel>

      <Panel
        title="Incidencias"
        meta={
          loading || !metrics
            ? 'consultando…'
            : metrics.incidents.length
              ? `${metrics.incidents.length} causa(s) distinta(s)`
              : 'sin fallos'
        }
        className="worker-panel-incidents"
      >
        {loading || !metrics ? (
          <p className="worker-chart-empty">Consultando los fallos registrados…</p>
        ) : (
          <WorkerIncidentsPanel incidents={metrics.incidents} window={metrics.totalRuns} />
        )}
      </Panel>

      <p className="worker-dashboard-source">
        <RefreshCw
          size={13}
          className={health.isFetching ? 'spin' : undefined}
          aria-hidden="true"
        />
        Lo calcula el motor sobre las ejecuciones de los últimos {dias} días, no esta pantalla sobre
        las que le quepan. Se actualiza solo cada 15 s mientras esta pestaña está a la vista.
      </p>
    </div>
  );
}

function mixLabel(metrics: WorkerMetrics): string {
  return metrics.statusMix
    .map((slice) => `${STATUS_LABEL[slice.status]}: ${slice.count}`)
    .join(', ');
}
