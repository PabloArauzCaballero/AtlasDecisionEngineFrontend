import { elapsedLabel, type WorkerMetrics } from './worker-types';

interface WorkerQueuePanelProps {
  queue: WorkerMetrics['queue'];
}

/**
 * Lo que el worker tiene delante ahora mismo.
 *
 * Cuenta y espera, que es lo que el motor sabe sin abrir cada fila: cuántas se
 * procesan, cuántas aguardan y desde cuándo espera la más antigua. Ese reloj es
 * la señal que importa: una cola de tres que lleva ocho minutos parada es una
 * incidencia, y una de tres recién llegada no es nada, y sin él las dos se leen
 * igual.
 */
export function WorkerQueuePanel({ queue }: WorkerQueuePanelProps) {
  const pending = queue.queued + queue.running;

  if (!pending) {
    return (
      <p className="worker-queue-empty">
        No hay nada esperando. Todo lo que se encoló ya terminó, y las ejecuciones nuevas aparecerán
        aquí en cuanto se envíen.
      </p>
    );
  }

  const espera = elapsedLabel(queue.oldestQueuedAt);

  return (
    <ul className="worker-queue">
      {queue.running > 0 ? (
        <li className="worker-queue-row is-running">
          <span className="worker-queue-dot tone-running" aria-hidden="true" />
          <div className="worker-queue-copy">
            <strong>Procesándose</strong>
            <small>Un worker las tiene tomadas ahora mismo.</small>
          </div>
          <span className="worker-queue-count">{queue.running}</span>
        </li>
      ) : null}
      {queue.queued > 0 ? (
        <li className="worker-queue-row">
          <span className="worker-queue-dot tone-queued" aria-hidden="true" />
          <div className="worker-queue-copy">
            <strong>Esperando turno</strong>
            <small>
              {espera
                ? `La más antigua lleva ${espera} en cola.`
                : 'Esperando a que un worker las tome.'}
            </small>
          </div>
          <span className="worker-queue-count">{queue.queued}</span>
        </li>
      ) : null}
    </ul>
  );
}
