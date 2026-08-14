'use client';

import type { WorkerDescriptor } from './worker-types';
import { formatNumber } from '../../config/locale';

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

/**
 * Nombres en español para los límites que publica el motor.
 *
 * La ficha sin traducir enseña la clave del contrato en mayúsculas
 * —`OCRPROVIDER`— justo donde se espera una etiqueta. Se descubrió mirando la
 * captura de evidencia del worker de identidad, que publica cuatro claves que
 * este mapa no tenía.
 */
function limitLabel(key: string): string {
  const labels: Record<string, string> = {
    maxTextLength: 'Longitud máxima',
    maxUploadBytes: 'Tamaño máximo',
    maxFiles: 'Archivos por ejecución',
    acceptedMimeTypes: 'Formato admitido',
    ocrProvider: 'Lectura del documento',
    faceProvider: 'Comparación de rostros',
    livenessProvider: 'Prueba de vida',
    thresholdProfile: 'Perfil de umbrales',
  };
  return labels[key] ?? key;
}

function formatLimit(key: string, value: number | string): string {
  if (key === 'maxUploadBytes' && typeof value === 'number') {
    return `${Math.round(value / 1_048_576)} MiB`;
  }
  if (key === 'maxTextLength' && typeof value === 'number') {
    return `${formatNumber(value)} caracteres`;
  }
  /*
   * Los proveedores y el perfil de umbrales se traducen a lo que significan
   * para quien mira. `unconfigured` es el aviso de que toda verificación va a
   * terminar en revisión manual, y un perfil `sintetico-…` el de que el corte se
   * midió sobre rostros dibujados y no predice la tasa de error sobre personas.
   * Dejarlos en su forma técnica los convertía en palabras que sólo entiende
   * quien configuró el motor.
   */
  if (key.endsWith('Provider')) {
    if (value === 'tesseract') return 'Local, sin conexión';
    if (value === 'human') return 'Biometría local, sin conexión';
    if (value === 'disabled') return 'Deshabilitada';
    // `mock` ya no lo emite el motor. Se conserva la traducción porque un motor
    // más antiguo detrás de este portal seguiría publicándolo, y enseñar
    // «mock» a secas no avisaría de nada a quien lo lee.
    if (value === 'mock') return 'Simulado (no es un proveedor real)';
  }
  if (key === 'thresholdProfile') {
    if (value === 'unconfigured') return 'Sin calibrar';
    if (typeof value === 'string' && value.startsWith('sintetico')) {
      return `${value} · calibrado sobre rostros sintéticos`;
    }
  }
  return String(value);
}
