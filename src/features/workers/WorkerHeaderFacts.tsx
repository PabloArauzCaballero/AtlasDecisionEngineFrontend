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
 *
 * **Una ficha ocupa UNA línea, y las salvedades no caben dentro.** Iban a dos
 * pisos —rótulo arriba, valor abajo, en un bloque gris— y nueve bloques de dos
 * pisos con anchos distintos no forman una fila que se pueda barrer con la
 * mirada: forman un muro. El perfil de umbrales era el caso extremo, con la
 * advertencia «calibrado sobre rostros sintéticos» metida DENTRO del valor, lo
 * que estiraba esa ficha hasta ocupar ella sola un renglón entero. La salvedad
 * es una frase, no un dato: va debajo, en `limitNote`.
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

  const limits = Object.entries(descriptor.limits);
  const notes = limits
    .map(([key, value]) => limitNote(key, value))
    .filter((note): note is string => note !== null);

  return (
    <div className="worker-facts">
      <ul className="worker-facts-list">
        <li className="worker-fact">
          <span className="worker-fact-label">Acepta</span>
          <span className="worker-fact-value">{descriptor.acceptedInputs.join(' · ')}</span>
        </li>
        {limits.map(([key, value]) => (
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
      {notes.length > 0 ? <p className="worker-facts-note">{notes.join(' ')}</p> : null}
    </div>
  );
}

/**
 * Nombres en español para los límites que publica el motor.
 *
 * La ficha sin traducir enseña la clave del contrato tal cual —`voiceProfile`,
 * `monthlyBudgetUnits`— justo donde se espera una etiqueta. Se descubrió
 * mirando la captura de evidencia del worker de identidad; el de locución
 * publica otras cinco claves que este mapa tampoco tenía, así que la consola de
 * voz abría con media fila en camelCase.
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
    provider: 'Proveedor de voz',
    voiceProfile: 'Voz',
    outputFormat: 'Formato de salida',
    monthlyBudgetUnits: 'Presupuesto mensual',
    generationsPerActorDay: 'Generaciones por persona y día',
  };
  return labels[key] ?? key;
}

/**
 * Los tipos MIME, con el nombre por el que se conoce el archivo.
 *
 * `image/jpeg, image/png, image/webp` es cómo está hecho el sistema; JPEG, PNG
 * y WebP es lo que ve quien elige la foto en su carpeta. Además cabe: la cadena
 * completa medía más que el resto de la fila junta.
 */
function formatMimeTypes(value: string): string {
  const NOMBRES: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
    'application/pdf': 'PDF',
    'audio/mpeg': 'MP3',
  };
  return value
    .split(',')
    .map((mime) => mime.trim())
    .filter((mime) => mime !== '')
    .map((mime) => NOMBRES[mime] ?? mime)
    .join(' · ');
}

function formatLimit(key: string, value: number | string): string {
  if (key === 'maxUploadBytes' && typeof value === 'number') {
    return `${Math.round(value / 1_048_576)} MiB`;
  }
  if (key === 'maxTextLength' && typeof value === 'number') {
    return `${formatNumber(value)} caracteres`;
  }
  if (key === 'monthlyBudgetUnits' && typeof value === 'number') {
    return `${formatNumber(value)} unidades`;
  }
  if (key === 'acceptedMimeTypes' && typeof value === 'string') {
    return formatMimeTypes(value);
  }
  /*
   * Los proveedores y el perfil de umbrales se traducen a lo que significan
   * para quien mira. `unconfigured` es el aviso de que toda verificación va a
   * terminar en revisión manual. Dejarlos en su forma técnica los convertía en
   * palabras que sólo entiende quien configuró el motor.
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
  if (key === 'thresholdProfile' && value === 'unconfigured') return 'Sin calibrar';
  return String(value);
}

/**
 * La salvedad de un límite: una frase, no un dato.
 *
 * Un perfil `sintetico-…` avisa de que el corte se midió sobre rostros
 * dibujados y no predice la tasa de error sobre personas. Eso no es el valor
 * del límite —el valor es el nombre del perfil— y meterlo dentro de la ficha la
 * estiraba hasta romper la fila. Debajo se lee entero y no empuja a nadie.
 */
function limitNote(key: string, value: number | string): string | null {
  if (key !== 'thresholdProfile' || typeof value !== 'string') return null;
  if (value.startsWith('sintetico')) {
    return 'El perfil de umbrales se calibró sobre rostros sintéticos: no predice la tasa de error sobre personas reales.';
  }
  if (value === 'unconfigured') {
    return 'Sin umbrales calibrados, toda verificación termina en revisión manual.';
  }
  return null;
}
