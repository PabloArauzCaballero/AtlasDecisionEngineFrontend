'use client';

import type { ReactNode } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import {
  elapsedLabel,
  isTerminal,
  STATUS_HELP,
  STATUS_LABEL,
  statusTone,
  type WorkerRun,
} from './worker-types';

interface WorkerRunTrackerProps {
  run: WorkerRun;
  /** Acciones propias de cada worker (descargas, por ejemplo). */
  actions?: ReactNode;
  onCancel?: () => void;
  cancelling?: boolean;
  onReset: () => void;
}

/**
 * Seguimiento de una ejecución: estado, progreso, intentos y errores.
 *
 * Es común a los dos workers porque su ciclo de vida es idéntico; lo que cambia
 * —la entrada y la forma del resultado— lo pone cada vista.
 *
 * Tres decisiones que vienen del encargo y conviene no deshacer:
 *
 * 1. **La pantalla nunca se queda congelada.** Mientras hay trabajo se ve la
 *    barra, el intento y el tiempo transcurrido, no un botón deshabilitado.
 * 2. **Nada se marca como completado hasta que lo confirma el backend.** El
 *    estado que se pinta es el que devolvió la última consulta.
 * 3. **El resultado no se comunica sólo con un aviso emergente.** Un proceso
 *    largo tiene que dejar constancia en la página: un toast se pierde si el
 *    usuario estaba mirando otra cosa.
 */
export function WorkerRunTracker({
  run,
  actions,
  onCancel,
  cancelling = false,
  onReset,
}: WorkerRunTrackerProps) {
  const running = !isTerminal(run.status);
  const elapsed = elapsedLabel(run.startedAt ?? run.queuedAt, run.finishedAt);
  const failed = run.status === 'FAILED';

  return (
    <div className="worker-run">
      <div className="worker-run-head">
        <StatusBadge
          value={statusTone(run.status)}
          labels={{ [statusTone(run.status)]: STATUS_LABEL[run.status] }}
        />
        <p className="worker-run-help">{STATUS_HELP[run.status]}</p>
      </div>

      {/*
       * `aria-live="polite"` y no `assertive`: el progreso cambia cada segundo y
       * medio, y anunciarlo de forma asertiva interrumpiría al lector de
       * pantalla constantemente. Polite espera a que termine lo que está leyendo.
       */}
      <div className="worker-run-progress" aria-live="polite">
        <div
          className="worker-progress-track"
          role="progressbar"
          aria-valuenow={run.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso: ${run.progress} por ciento`}
        >
          <div
            className={`worker-progress-fill${running ? ' is-running' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, run.progress))}%` }}
          />
        </div>
        <span className="worker-progress-value">{run.progress}%</span>
      </div>

      <dl className="worker-run-facts">
        <div>
          <dt>Identificador</dt>
          <dd>
            <code>{run.requestId}</code>
          </dd>
        </div>
        <div>
          <dt>Intento</dt>
          <dd>{run.attemptCount || 1}</dd>
        </div>
        <div>
          <dt>Encolada</dt>
          <dd>{new Date(run.queuedAt).toLocaleString('es-BO')}</dd>
        </div>
        {elapsed ? (
          <div>
            <dt>{run.finishedAt ? 'Duración' : 'Transcurrido'}</dt>
            <dd>{elapsed}</dd>
          </div>
        ) : null}
        <div>
          <dt>Origen</dt>
          <dd>{run.inputSource === 'FIXTURE' ? 'Datos de prueba' : 'Datos propios'}</dd>
        </div>
      </dl>

      {failed ? (
        // `role="alert"` sólo en el fallo: es lo único que exige atención
        // inmediata. Ponerlo en cada cambio de estado lo volvería ruido.
        <div className="worker-run-error" role="alert">
          <p className="worker-error-message">
            {run.errorMessage ?? 'La ejecución no se pudo completar.'}
          </p>
          <p className="worker-error-detail">
            Código técnico: <code>{run.errorCode ?? 'DESCONOCIDO'}</code>
            <br />
            Identificador de correlación: <code>{run.correlationId}</code>
          </p>
          <p className="worker-error-hint">
            Si el problema se repite, pasa esos dos valores a la persona que opere el motor:
            identifican esta ejecución exacta en sus registros.
          </p>
        </div>
      ) : null}

      <div className="worker-run-actions">
        {actions}
        {run.status === 'QUEUED' && onCancel ? (
          <button type="button" className="button" onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelando…' : 'Cancelar'}
          </button>
        ) : null}
        {isTerminal(run.status) ? (
          <button type="button" className="button" onClick={onReset}>
            Nueva ejecución
          </button>
        ) : null}
      </div>
    </div>
  );
}
