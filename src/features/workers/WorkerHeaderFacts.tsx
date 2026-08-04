'use client';

import type { WorkerDescriptor } from './worker-types';

/**
 * Encabezado de un worker: qué acepta, con qué límites y si está disponible.
 *
 * Los límites vienen del backend, no escritos a mano aquí. Un portal que
 * codifica «máximo 10 MiB» en su formulario miente en cuanto alguien cambia la
 * variable de entorno del motor, y el usuario descubre el límite real al recibir
 * un rechazo que no esperaba.
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
      <p className="worker-facts-description">{descriptor.description}</p>
      <ul className="worker-facts-list">
        <li>
          <strong>Acepta:</strong> {descriptor.acceptedInputs.join(' · ')}
        </li>
        {Object.entries(descriptor.limits).map(([key, value]) => (
          <li key={key}>
            <strong>{limitLabel(key)}:</strong> {formatLimit(key, value)}
          </li>
        ))}
        <li>
          <strong>Estado:</strong> {descriptor.available ? 'Disponible' : 'Apagado en este entorno'}
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
