import { asRecord, type UnknownRecord } from '../../utils/records';
import { DEFAULT_QA_CONFIG, type QaRunConfig } from './qa-run-config';

/**
 * Lo que una corrida archivada dice de sí misma, en español.
 *
 * El motor guarda con cada corrida la configuración con la que se lanzó (`config`), por qué
 * se cortó si no recorrió todo (`stoppedReason`), por qué se interrumpió si falló
 * (`summary.failureCode`) y de dónde salieron sus datos (`fakers`). Esta pantalla enseñaba
 * sólo la semilla, y la semilla sola no reproduce nada: el lote depende también del número
 * de casos, la mezcla, los pesos por desenlace, las distribuciones y la versión.
 */

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** La configuración archivada, lista para volver a lanzarla tal cual. */
export function configFromArchive(archived: unknown, seed: string): QaRunConfig {
  const config = asRecord(archived);
  const mix = asRecord(config.mix);
  const weights = asRecord(config.outcomeWeights);
  return {
    caseCount: num(config.caseCount, DEFAULT_QA_CONFIG.caseCount),
    seed,
    validPercent: num(mix.validPercent ?? config.validPercent, DEFAULT_QA_CONFIG.validPercent),
    boundaryPercent: num(
      mix.boundaryPercent ?? config.boundaryPercent,
      DEFAULT_QA_CONFIG.boundaryPercent,
    ),
    invalidPercent: num(
      mix.invalidPercent ?? config.invalidPercent,
      DEFAULT_QA_CONFIG.invalidPercent,
    ),
    concurrency: num(config.concurrency, DEFAULT_QA_CONFIG.concurrency),
    timeoutMs: num(config.timeoutMs, DEFAULT_QA_CONFIG.timeoutMs),
    stopOnFirstFailure: bool(config.stopOnFirstFailure, false),
    checkDeterminism: bool(config.checkDeterminism, false),
    // Las corridas anteriores al campo se lanzaron con los desenlaces activados por omisión.
    coverOutcomes: bool(config.coverOutcomes, true),
    // `outcomeAllocation` es el reparto YA resuelto; los pesos originales son los que se piden.
    outcomeWeights: Object.fromEntries(
      Object.entries(weights).filter(([, weight]) => typeof weight === 'number'),
    ) as Record<string, number>,
    distributions: Array.isArray(config.distributions)
      ? (config.distributions as UnknownRecord[])
      : distributionsFromMap(config.distributions),
  };
}

/** El motor archiva las distribuciones ya resueltas como mapa `{ código: {...} }`. */
function distributionsFromMap(value: unknown): UnknownRecord[] {
  return Object.entries(asRecord(value)).map(([variableCode, entry]) => ({
    variableCode,
    ...asRecord(entry),
  }));
}

export const STOP_REASON_TEXT: Readonly<Record<string, string>> = {
  TIMEOUT:
    'Se cortó al agotar el tiempo máximo: no ejecutó todos los casos. Sube el tiempo máximo o baja el número de casos para cubrir el lote entero.',
  FIRST_FAILURE:
    'Se detuvo en el primer caso con fallo, como pediste: el resto del lote no se ejecutó.',
};

/** Motivos por los que una corrida se interrumpe, traducidos. */
const RUN_FAILURE_TEXT: Readonly<Record<string, string>> = {
  QA_RUN_UNEXPECTED_ERROR: 'El motor tuvo un error inesperado mientras ejecutaba el lote.',
  QA_VERSION_NOT_COMPILED: 'La versión no tiene un artefacto compilado con éxito.',
};

export interface RunFailure {
  title: string;
  detail: string;
}

/** Por qué una corrida quedó «Interrumpida». `null` si no lo está. */
export function runFailureOf(run: UnknownRecord): RunFailure | null {
  if (String(run.status ?? '') !== 'FAILED') return null;
  const summary = asRecord(run.summary);
  const code = String(summary.failureCode ?? '');
  const message = String(summary.failureMessage ?? '');
  if (!code) {
    return {
      title: 'La corrida se quedó sin terminar',
      detail:
        'Llevaba más de once minutos «en marcha» sin cerrar: casi siempre es que el motor se reinició a mitad del lote. Vuelve a lanzarla con «Reproducir».',
    };
  }
  return {
    title: RUN_FAILURE_TEXT[code] ?? 'La corrida se interrumpió antes de terminar.',
    detail: message
      ? `Detalle del motor: ${message}`
      : 'El motor no dio más detalle. Si se repite, avisa a soporte.',
  };
}

/** Qué significa cada código de fallo de un caso, para quien no lee el código fuente. */
export const CASE_FAILURE_TEXT: Readonly<Record<string, string>> = {
  INVALID_INPUT_ACCEPTED: 'El motor aceptó una entrada que el contrato prohíbe.',
  VALID_INPUT_REJECTED: 'El motor rechazó una entrada que cumple el contrato.',
  REQUIRED_OUTPUT_MISSING: 'Falta una salida obligatoria en una decisión terminada.',
  OUTPUT_TYPE_MISMATCH: 'Una salida tiene un tipo distinto del declarado.',
  INTERMEDIATE_EXPOSED: 'Un cálculo interno apareció en la respuesta.',
  SENSITIVE_VALUE_IN_OUTPUT: 'Un dato sensible de la entrada salió en la respuesta.',
  NON_DETERMINISTIC_RESULT: 'La misma entrada dio dos resultados distintos.',
  UNEXPECTED_ENGINE_ERROR: 'El motor lanzó un error no controlado con esta entrada.',
};

export interface FakerNote {
  tone: 'info' | 'warning';
  text: string;
}

/** De dónde salieron los datos del lote, dicho sin rodeos. `null` en corridas antiguas. */
export function fakerNoteOf(fakers: unknown): FakerNote | null {
  const report = asRecord(fakers);
  const source = String(report.source ?? '');
  const mapped = Object.keys(asRecord(report.mappedVariables));
  if (source === 'mock') {
    return {
      tone: 'info',
      text: `Datos del generador de datos realistas (misma semilla) en ${mapped.length} variable(s): ${mapped.join(', ')}. El resto salió del contrato.`,
    };
  }
  if (source === 'local-fallback') {
    return {
      tone: 'warning',
      text: `El generador de datos realistas no estaba disponible, así que TODOS los valores salieron del generador del contrato: son válidos, pero nombres y documentos no parecen reales. ${String(report.reason ?? '')} Repetir esta corrida con el generador disponible dará otro lote.`,
    };
  }
  if (source === 'none') {
    return {
      tone: 'info',
      text: 'Ninguna variable de este algoritmo es un dato de persona o comercio reconocible (nombre, carnet, celular, ingreso…): todos los valores salen del contrato.',
    };
  }
  return null;
}
