'use client';

import type { ReactNode } from 'react';
import { FileJson, RotateCcw } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../config/locale';
import { downloadRunTrace } from './run-trace';
import {
  elapsedLabel,
  isTerminal,
  statusHelp,
  STATUS_LABEL,
  statusTone,
  type WorkerRun,
} from './worker-types';

interface WorkerRunTrackerProps {
  /** Código del worker: nombra el archivo de la traza descargable. */
  worker: string;
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
  worker,
  run,
  actions,
  onCancel,
  cancelling = false,
  onReset,
}: WorkerRunTrackerProps) {
  const terminado = isTerminal(run.status);
  const running = !terminado;
  /*
   * Una ejecución CERRADA pinta la barra llena, valga lo que valga la columna.
   *
   * El motor deja el progreso donde estaba cuando decidió el desenlace —25 % en
   * un PDF rechazado, que es lo que había avanzado al mirar la carátula— y la
   * pantalla lo enseñaba tal cual: una barra a un cuarto, quieta, bajo una
   * insignia que ya decía «PDF no válido». Se lee como que el worker se colgó,
   * que es justo lo contrario de lo que pasó: falló rápido y a propósito.
   *
   * Esto NO contradice la regla de arriba —nada se marca como completado hasta
   * que lo confirma el backend—: quien dice que la ejecución terminó sigue
   * siendo el estado que vino del motor. La barra sólo deja de prometer un
   * trabajo que ya no va a ocurrir; el desenlace lo cuentan la insignia y su
   * color, no el relleno.
   */
  const progreso = terminado ? 100 : Math.min(100, Math.max(0, run.progress));
  const elapsed = elapsedLabel(run.startedAt ?? run.queuedAt, run.finishedAt);
  const failed = run.status === 'FAILED';
  /*
   * Un rechazo NO es una avería, y por eso no reutiliza el bloque de `failed`.
   *
   * El motor rechaza escribiendo en `errorMessage` una frase pensada para quien
   * subió la foto —«la imagen tiene texto, pero no corresponde a ningún
   * documento admitido; envía una foto de tu carnet, completo y enfocado»— y la
   * consola no la enseñaba en ningún sitio: el único bloque que imprime
   * `errorMessage` se pinta sólo con `FAILED`. Quedaba una pantalla detenida sin
   * decir por qué, que es la peor versión posible de un rechazo que sí sabía
   * explicarse. Va sin `role="alert"` ni código técnico: no hay nada que pasarle
   * a quien opera el motor, la acción está en manos de quien mira.
   */
  const rejected = run.status === 'DOCUMENT_REJECTED' || run.status === 'PDF_INVALID';

  return (
    <div className="worker-run">
      <div className="worker-run-head">
        <StatusBadge
          value={statusTone(run.status)}
          labels={{ [statusTone(run.status)]: STATUS_LABEL[run.status] }}
        />
        <p className="worker-run-help">{statusHelp(run)}</p>
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
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso: ${progreso} por ciento`}
        >
          <div
            className={`worker-progress-fill${running ? ' is-running' : ''}`}
            data-tono={statusTone(run.status).toLowerCase()}
            style={{ width: `${progreso}%` }}
          />
        </div>
        <span className="worker-progress-value">{progreso}%</span>
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
          <dd>{formatDateTime(run.queuedAt)}</dd>
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

      {rejected && run.errorMessage ? (
        <div className="worker-run-rejected">
          <p className="worker-rejected-message">{run.errorMessage}</p>
        </div>
      ) : null}

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
        {/*
         * La traza sólo cuando la ejecución terminó: a medio camino describiría
         * un estado que ya no existe al abrir el archivo. Lleva lo que el motor
         * publicó —resultado completo, diagnóstico, advertencias, correlación—,
         * que es lo que hace depurable un «salió mal» sin volver a ejecutarlo.
         */}
        {terminado ? (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => downloadRunTrace(worker, run)}
          >
            <FileJson size={15} aria-hidden="true" /> Descargar traza (.json)
          </button>
        ) : null}
        {run.status === 'QUEUED' && onCancel ? (
          <button type="button" className="button" onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelando…' : 'Cancelar'}
          </button>
        ) : null}
      </div>

      {/*
       * Volver a empezar es la ÚNICA acción que queda cuando la ejecución cerró,
       * y por eso sale de la fila y va sola, centrada y con el peso de la acción
       * principal. Iba de tercer botón gris junto a la descarga de la traza: la
       * salida obvia de la pantalla se leía como una opción secundaria, y quien
       * acababa de recibir un rechazo se quedaba sin saber por dónde reintentar.
       * El pie explica qué hace, porque «nueva» junto a un resultado en pantalla
       * se puede entender como que se pierde lo que hay.
       */}
      {terminado ? (
        <div className="worker-run-again">
          <button
            type="button"
            className="button button-primary worker-run-again-boton"
            onClick={onReset}
          >
            <RotateCcw size={16} aria-hidden="true" /> Nueva ejecución
          </button>
          <p className="worker-run-again-help">
            Vacía el formulario para procesar otro documento. Ésta queda registrada con su
            identificador.
          </p>
        </div>
      ) : null}
    </div>
  );
}
