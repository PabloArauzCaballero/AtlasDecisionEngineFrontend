import { ShieldCheck } from 'lucide-react';
import { elapsedLabel, type WorkerIncident } from './worker-types';

interface WorkerIncidentsPanelProps {
  incidents: readonly WorkerIncident[];
  /** Sobre cuántas ejecuciones se miró: sin esto, «0 fallos» no dice nada. */
  window: number;
}

/**
 * Los fallos que ha tenido el worker, agrupados por causa.
 *
 * El agrupado lo hace el motor (`DISTINCT ON` sobre la ventana), no esta vista:
 * veinte filas con el mismo `TIMEOUT` son **una** incidencia que ocurrió veinte
 * veces, y agruparlas aquí sólo habría agrupado las que cupieran en la página.
 * Se conserva el identificador de correlación de la más reciente, que es por
 * donde se sigue el rastro en los registros del motor.
 */
export function WorkerIncidentsPanel({ incidents, window }: WorkerIncidentsPanelProps) {
  if (!incidents.length) {
    return (
      <p className="worker-incidents-clear">
        <ShieldCheck size={16} aria-hidden="true" />
        Ninguna de las últimas {window} ejecuciones falló.
      </p>
    );
  }

  return (
    <ul className="worker-incidents">
      {incidents.map((incident) => (
        <li key={incident.code} className="worker-incident">
          <div className="worker-incident-head">
            <code className="worker-incident-code">{incident.code}</code>
            <span className="worker-incident-count">
              {incident.count === 1 ? '1 vez' : `${incident.count} veces`}
            </span>
            <span className="worker-incident-when">
              última hace {elapsedLabel(incident.lastOccurredAt) ?? '—'}
            </span>
          </div>
          <p className="worker-incident-message">
            {incident.message ?? 'El motor no adjuntó ningún mensaje.'}
          </p>
          <dl className="worker-incident-trace">
            <dt>Correlación</dt>
            <dd>
              <code>{incident.lastCorrelationId}</code>
            </dd>
            <dt>Ejecución</dt>
            <dd>
              <code>{incident.lastRequestId}</code>
            </dd>
            <dt>Intentos</dt>
            <dd>{incident.lastAttemptCount}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
