import type { Option, OptionDescriptions } from '../../contracts/option';
import { display, type UnknownRecord } from '../../utils/records';
import { OPERATOR_LABELS, type OperatorId } from './condition-operators';

/**
 * Qué significa cada opción cerrada del editor de grafos y cuándo elegirla.
 *
 * El editor es donde una elección equivocada decide casos reales sin dar error:
 * «Mayor que» contra «Mayor o igual que» es un cliente aprobado o rechazado en el
 * borde, y «La activa del ambiente» contra «La versión fijada» es una decisión
 * que se puede o no reproducir mañana. Cada texto dice la consecuencia, no
 * repite la etiqueta.
 */
export const OPERATOR_HELP: Readonly<Record<OperatorId, string>> = {
  eq: 'Se cumple sólo si el dato coincide exactamente con el valor.',
  neq: 'Se cumple con cualquier valor salvo el indicado; incluye los vacíos.',
  gt: 'Se cumple por encima del valor; el propio valor NO cuenta.',
  gte: 'Se cumple desde el valor hacia arriba; el propio valor SÍ cuenta.',
  lt: 'Se cumple por debajo del valor; el propio valor NO cuenta.',
  lte: 'Se cumple hasta el valor inclusive; el propio valor SÍ cuenta.',
  in: 'Se cumple si el dato es uno de varios valores que escribes en lista.',
  not_in: 'Se cumple si el dato no es ninguno de los valores de la lista.',
  contains: 'Se cumple si el texto o la lista incluye el valor en cualquier parte.',
  starts_with: 'Se cumple si el texto arranca con el valor; útil para prefijos de código.',
  ends_with: 'Se cumple si el texto acaba con el valor; útil para dominios o sufijos.',
};

export const operatorOptions = (ids: readonly string[]): Option[] =>
  ids.map((id) => ({
    value: id,
    label: OPERATOR_LABELS[id as OperatorId] ?? id,
    description: OPERATOR_HELP[id as OperatorId],
  }));

/** De dónde sale un campo del contrato de salida (§4). */
export const OUTPUT_SOURCE_HELP: OptionDescriptions = {
  NODE: 'Lo escribe un paso del grafo; eliges cuál en «Referencia».',
  INTERMEDIATE: 'Se copia de una variable intermedia que calculó el algoritmo.',
  EXPRESSION: 'Se calcula al final con una expresión sobre otras variables.',
  CONSTANT: 'Siempre sale el mismo valor, sea cual sea el caso.',
  REFERENCE: 'Lo devuelve otro algoritmo al que este llama como subdecisión.',
};

/** Cómo se actualiza una variable intermedia (§2.2). */
export const UPDATE_POLICY_HELP: OptionDescriptions = {
  SINGLE_WRITE:
    'El nodo productor la fija y nadie puede volver a escribirla en la misma ejecución.',
  OVERWRITE: 'El nodo productor puede recalcularla si vuelve a visitarse.',
  ACCUMULATE: 'Cada escritura suma sobre el valor anterior (números, listas o texto).',
};

/** Qué versión de un algoritmo referenciado se ejecuta. */
export const VERSION_SELECTION_HELP: OptionDescriptions = {
  EXACT: 'Siempre la misma versión: la decisión se puede reproducir años después.',
  ACTIVE_IN_ENVIRONMENT:
    'La que esté desplegada al ejecutar: recoge mejoras sin tocar este algoritmo, pero no se reproduce igual.',
};

/** Qué deja ver la traza del resultado de un algoritmo referenciado. */
export const REFERENCE_TRACE_HELP: OptionDescriptions = {
  FULL: 'La traza guarda todo lo que devolvió; para resultados sin datos personales.',
  MASKED: 'La traza guarda el resultado con los datos sensibles ocultos.',
  REDACTED: 'La traza sólo guarda que se llamó, cuánto tardó y cómo terminó.',
  EXCLUDED: 'La llamada no deja rastro del resultado en la traza.',
};

/** Formatos semánticos de una restricción de texto. */
export { FORMAT_DESCRIPTIONS as CONSTRAINT_FORMAT_HELP } from '../../contracts/constraint-details';

/** Tipo de rama de una conexión. */
export const EDGE_KIND_HELP: OptionDescriptions = {
  CONDITIONAL: 'El camino se recorre sólo si su condición es cierta para el caso.',
  DEFAULT: 'Salida de escape: la toma todo caso que no encajó en otra rama.',
};

/** Lenguaje de un paso de código. */
export const SCRIPT_LANGUAGE_HELP: OptionDescriptions = {
  JAVASCRIPT: 'Corre en el motor con JavaScript; el más rápido para cálculos sencillos.',
  PYTHON: 'Corre en el motor con Python; útil si el cálculo ya existe en ese lenguaje.',
};

/** Prioridad de un caso enviado a revisión manual. */
export const REVIEW_PRIORITY_HELP: OptionDescriptions = {
  LOW: 'Puede esperar; se atiende cuando la cola esté al día.',
  NORMAL: 'Orden de llegada; es la opción habitual.',
  MEDIUM: 'Orden de llegada; es la opción habitual.',
  HIGH: 'Se atiende antes que los normales: hay plazo o importe en juego.',
  CRITICAL: 'Pasa delante de todo; para fraude en curso o bloqueos de clientes.',
  URGENT: 'Pasa delante de todo; para fraude en curso o bloqueos de clientes.',
};

/** Severidad de un motivo que emite un paso. */
export const SEVERITY_HELP: OptionDescriptions = {
  INFO: 'Sólo informa; no cambia el sentido de la decisión.',
  LOW: 'Señal leve; conviene registrarla pero no pesa en la decisión.',
  MEDIUM: 'Señal a tener en cuenta al revisar el caso.',
  HIGH: 'Señal grave; suele justificar un rechazo o una revisión.',
  CRITICAL: 'Bloquea: el caso no puede aprobarse con este motivo presente.',
};

/**
 * Una variable del catálogo como opción. Es una ENTIDAD, así que la descripción
 * es su ficha resumida —nombre · tipo—, no un significado inventado.
 */
export function catalogVariableOption(item: UnknownRecord): Option {
  const nombre = display(item, 'canonicalName', 'name');
  return {
    value: display(item, 'definitionId'),
    label: `${display(item, 'variableCode')} · ${display(item, 'dataType')}`,
    description: nombre !== '—' ? nombre : undefined,
  };
}

/** Opciones de un mapa `valor → etiqueta` con su mapa de descripciones. */
export const closedOptions = (
  labels: Readonly<Record<string, string>> | readonly { value: string; label: string }[],
  help: OptionDescriptions,
): Option[] =>
  (Array.isArray(labels)
    ? labels
    : Object.entries(labels).map(([value, label]) => ({ value, label }))
  ).map(({ value, label }) => ({ value, label, description: help[value] }));

/** Claves de nodos del grafo: entidades del propio grafo, sin glosa. */
export const nodeKeyOptions = (keys: readonly string[]): Option[] =>
  keys.map((key) => ({ value: key, label: key }));

/** Qué poner en cada restricción numérica de un contrato de variable. */
export const CONSTRAINT_FIELD_HELP: Readonly<Record<string, string>> = {
  min: 'Valor más bajo aceptado; el propio mínimo SÍ entra. Ej.: 0.',
  max: 'Valor más alto aceptado; el propio máximo SÍ entra. Ej.: 100000.',
  exclusiveMin: 'El valor tiene que quedar estrictamente por encima; el propio número NO entra.',
  exclusiveMax: 'El valor tiene que quedar estrictamente por debajo; el propio número NO entra.',
  scale: 'Cuántos decimales como máximo admite el valor. Ej.: 2 para céntimos.',
  precision: 'Cuántos dígitos en total admite el valor, contando enteros y decimales.',
  minLength: 'Número mínimo de caracteres del texto. Ej.: 7 para un documento.',
  maxLength: 'Número máximo de caracteres del texto; lo que pase se rechaza.',
  minItems: 'Cuántos elementos tiene que traer la lista como mínimo.',
  maxItems: 'Cuántos elementos puede traer la lista como máximo.',
};

/** Qué hace cada tipo de acción del catálogo del algoritmo. */
export const ACTION_TYPE_HELP: OptionDescriptions = {
  SET_FIELD:
    'Escribe un valor que otros pasos podrán leer (tipo heredado: hoy se usa un campo calculado).',
  EMIT_REASON: 'Añade un reason code explicable al resultado de la decisión.',
  CREATE_MANUAL_REVIEW: 'Deriva el caso a una persona en lugar de resolverlo automáticamente.',
};

/** Un paso de entrada (variable del algoritmo) como opción: su ficha es el tipo. */
export const inputOption = (input: UnknownRecord): Option => ({
  value: display(input, 'code'),
  label: `${display(input, 'code')} · ${display(input, 'dataType')}`,
  description:
    display(input, 'name', 'canonicalName') !== '—'
      ? display(input, 'name', 'canonicalName')
      : undefined,
});
