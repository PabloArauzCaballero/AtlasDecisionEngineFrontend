'use client';

import type { WorkerDescriptor } from './worker-types';

/**
 * Encabezado de un worker: qué acepta, con qué límites y si está disponible.
 *
 * Los límites vienen del backend, no escritos a mano aquí. Un portal que
 * codifica «máximo 10 MiB» en su formulario miente en cuanto alguien cambia la
 * variable de entorno del motor, y el usuario descubre el límite real al recibir
 * un rechazo que no esperaba.
 *
 * **No repite la descripción del worker.** La imprimía, y la cabecera de la
 * página imprime exactamente la misma frase del mismo `descriptor` doscientos
 * píxeles más arriba: la consola abría con el mismo texto dos veces seguidas.
 * Aquí sólo van los límites, que es lo que la cabecera no dice.
 */
export function WorkerHeaderFacts({
  descriptor,
  loading,
}: {
  descriptor?: WorkerDescriptor;
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="worker-facts is-loading" aria-live="polite">
        Consultando la disponibilidad del worker…
      </p>
    );
  }
  if (!descriptor) {
    return (
      <p className="worker-facts is-error" role="alert">
        No se pudo consultar el catálogo de workers. Vuelve a intentarlo o revisa la conexión con el
        motor.
      </p>
    );
  }

  return (
    <div className="worker-facts">
      {/*
       * Una ficha por dato y no una frase corrida: son los límites contra los
       * que se va a chocar al enviar algo, y hay que poder encontrarlos de un
       * vistazo mientras se rellena el formulario de abajo, no leerlos.
       */}
      <ul className="worker-facts-list">
        <li className="worker-fact">
          <span className="worker-fact-label">Acepta</span>
          <span className="worker-fact-value">{descriptor.acceptedInputs.join(' · ')}</span>
        </li>
        {Object.entries(descriptor.limits).map(([key, value]) => (
          <li key={key} className="worker-fact">
            <span className="worker-fact-label">{limitLabel(key)}</span>
            <span className="worker-fact-value">{formatLimit(key, value)}</span>
          </li>
        ))}
        <li className={`worker-fact is-state ${descriptor.available ? 'is-on' : 'is-off'}`}>
          <span className="worker-fact-label">Estado</span>
          <span className="worker-fact-value">
            <span className="worker-fact-dot" aria-hidden="true" />
            {descriptor.available ? 'Disponible' : 'Apagado en este entorno'}
          </span>
        </li>
      </ul>
    </div>
  );
}

/** Nombres en español para los límites que publica el motor. */
function limitLabel(key: string): string {
  const labels: Record<string, string> = {
    maxTextLength: 'Longitud máxima',
    maxUploadBytes: 'Tamaño máximo',
    maxFiles: 'Archivos por ejecución',
    acceptedMimeTypes: 'Formato admitido',
  };
  return labels[key] ?? key;
}

function formatLimit(key: string, value: number | string): string {
  if (key === 'maxUploadBytes' && typeof value === 'number') {
    return `${Math.round(value / 1_048_576)} MiB`;
  }
  if (key === 'maxTextLength' && typeof value === 'number') {
    return `${value.toLocaleString('es-BO')} caracteres`;
  }
  return String(value);
}
