import { durationLabel } from './worker-metrics';
import type { WorkerDescriptor, WorkerMetrics } from './worker-types';

interface WorkerVitalsProps {
  descriptor?: WorkerDescriptor;
  /** Salud publicada por el motor. Ausente mientras no ha contestado. */
  metrics?: WorkerMetrics;
  /** El catálogo todavía no ha contestado: no se sabe si está encendido. */
  catalogLoading: boolean;
  /** Las métricas todavía no han llegado: no se sabe cuánta cola ni cuántos fallos. */
  metricsLoading: boolean;
}

/** Mientras no hay respuesta, se dice que se está preguntando. */
const ASKING = { value: '…', hint: 'Consultando al motor…', tone: 'neutral' } as const;

/**
 * Las cinco cifras que contestan «¿puedo contar con este worker ahora mismo?».
 *
 * El tono de cada tarjeta se deriva del propio dato y no se elige a mano: verde
 * sólo cuando la cifra es buena de verdad, y neutro —no verde— cuando todavía
 * no hay con qué juzgar. Un panel que se pinta en verde por defecto enseña a no
 * mirarlo.
 *
 * Pero el tono sólo se PINTA cuando pide atención. Antes las cinco tarjetas
 * llevaban una franja de color y un icono en su cuadrito de color, así que la
 * fila salía verde-rojo-gris-azul-rojo: un semáforo en el que lo normal
 * («Encendido», «2 en la cola») gritaba tanto como el problema y ninguna de las
 * dos cifras que importan destacaba. Ahora lo bueno y lo neutro se dicen con la
 * palabra, y el color queda para lo que hay que mirar.
 *
 * Y mientras la respuesta no llega, se dice eso y no un cero: «0 fallos» y «0
 * en la cola» son afirmaciones, y afirmarlas antes de saberlo es exactamente el
 * error que un panel de operación no puede permitirse.
 */
export function WorkerVitals({
  descriptor,
  metrics,
  catalogLoading,
  metricsLoading,
}: WorkerVitalsProps) {
  const pending = (metrics?.queue.queued ?? 0) + (metrics?.queue.running ?? 0);
  const success = metrics?.successRate ?? null;
  const failures = metrics?.incidents.reduce((total, incident) => total + incident.count, 0) ?? 0;
  const sinMetricas = metricsLoading || !metrics;

  const tiles = [
    {
      label: 'Disponibilidad',
      ...(catalogLoading
        ? ASKING
        : {
            value: descriptor?.available ? 'Encendido' : 'Apagado',
            hint: descriptor?.available
              ? 'El motor acepta ejecuciones nuevas.'
              : 'Apagado en este despliegue: se consulta el historial, no se encola.',
            tone: descriptor?.available ? 'success' : 'danger',
          }),
    },
    {
      label: 'Ejecuciones con éxito',
      ...(sinMetricas
        ? ASKING
        : {
            value: success === null ? '—' : `${success.toFixed(success >= 99.5 ? 0 : 1)} %`,
            hint:
              success === null
                ? 'Ninguna ejecución ha terminado en la ventana.'
                : `Sobre ${metrics.finishedRuns} terminadas. Las canceladas no cuentan.`,
            tone:
              success === null
                ? 'neutral'
                : success >= 95
                  ? 'success'
                  : success >= 80
                    ? 'warning'
                    : 'danger',
          }),
    },
    {
      label: 'Latencia típica',
      ...(sinMetricas
        ? ASKING
        : {
            value: durationLabel(metrics.latency.p50Ms),
            hint:
              metrics.latency.p95Ms === null
                ? 'Se mide desde que un worker la toma hasta que termina.'
                : `Mediana. El 95 % terminó en menos de ${durationLabel(metrics.latency.p95Ms)}.`,
            tone: 'neutral',
          }),
    },
    {
      label: 'En la cola',
      ...(sinMetricas
        ? ASKING
        : {
            value: String(pending),
            hint: pending
              ? `${metrics.queue.running} procesándose y ${metrics.queue.queued} esperando turno.`
              : 'Nada esperando: el worker está al día.',
            tone: pending > 5 ? 'warning' : pending ? 'info' : 'success',
          }),
    },
    {
      label: 'Fallos recientes',
      ...(sinMetricas
        ? ASKING
        : {
            value: String(failures),
            hint: failures
              ? `${metrics.incidents.length} causa(s) distinta(s) sobre ${metrics.totalRuns} ejecuciones.`
              : `Ninguno sobre ${metrics.totalRuns} ejecuciones.`,
            tone: failures ? 'danger' : 'success',
          }),
    },
  ] as const;

  return (
    <div className={catalogLoading && sinMetricas ? 'worker-vitals is-loading' : 'worker-vitals'}>
      {tiles.map((tile) => (
        <article key={tile.label} className={`worker-vital tone-${tile.tone}`}>
          <p className="worker-vital-label">{tile.label}</p>
          <strong className="worker-vital-value">{tile.value}</strong>
          <small className="worker-vital-hint">{tile.hint}</small>
        </article>
      ))}
    </div>
  );
}
