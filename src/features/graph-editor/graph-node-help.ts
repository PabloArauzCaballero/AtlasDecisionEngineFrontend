import type { OptionDescriptions } from '../../contracts/option';

/**
 * Qué significa cada opción cerrada de los editores de nodo (resultado,
 * referencia, condición, llamadas a campos calculados). Aparte de
 * `graph-editor-help.ts` por el tope de 299 líneas.
 */

/** Cómo construye un nodo de resultado su salida. */
export const RESULT_MODE_HELP: OptionDescriptions = {
  MAPPING: 'Asignas cada salida desde un valor, una variable o una expresión, sin escribir código.',
  SCRIPT: 'Escribes el cálculo en código revisado; para lógica que no cabe en asignaciones.',
  REFERENCE: 'La salida la produce otro algoritmo al que este llama como subdecisión.',
};

/** De dónde sale el valor de una asignación del nodo de resultado. */
export const ASSIGNMENT_SOURCE_HELP: OptionDescriptions = {
  LITERAL: 'Un valor fijo que escribes tú y es igual para todos los casos.',
  VARIABLE: 'Se copia tal cual el valor de una variable de entrada del caso.',
  EXPRESSION: 'Se calcula con un árbol JSON {op, left, right} que evalúa el motor.',
  TEMPLATE: 'Texto con huecos que se rellenan con variables. Ej.: «Hola {{nombre}}».',
};

/** De dónde sale una entrada que se pasa a un algoritmo referenciado. */
export const REFERENCE_INPUT_SOURCE_HELP: OptionDescriptions = {
  VARIABLE: 'Se le pasa el valor de una variable de este algoritmo.',
  LITERAL: 'Se le pasa siempre el mismo valor, que escribes tú.',
};

/** Qué pasa si el algoritmo referenciado falla. */
export const ON_ERROR_POLICY_HELP: OptionDescriptions = {
  FAIL: 'La decisión entera falla y no se devuelve resultado; la opción más segura.',
  FALLBACK: 'Se sigue con una salida de reserva que declaras para ese caso.',
  SKIP: 'Se sigue como si la referencia no existiera; sus salidas quedan vacías.',
};

/** De dónde sale una entrada de un campo calculado invocado desde el grafo. */
export const CALL_INPUT_SOURCE_HELP: OptionDescriptions = {
  VARIABLE: 'Se toma una variable de entrada del algoritmo.',
  INTERMEDIATE: 'Se toma una variable intermedia que calculó un paso anterior.',
  LITERAL: 'Se usa siempre el mismo valor, que escribes tú.',
};

/** Dónde se guarda el resultado de un campo calculado invocado. */
export const CALL_TARGET_HELP: OptionDescriptions = {
  INTERMEDIATE: 'Queda disponible para los pasos siguientes, sin salir en la respuesta.',
  OUTPUT: 'Se devuelve en la respuesta del algoritmo a quien lo llamó.',
};

/** Valor de comparación de una variable booleana. */
export const BOOLEAN_VALUE_HELP: OptionDescriptions = {
  true: 'La condición se cumple cuando la variable llega marcada como sí.',
  false: 'La condición se cumple cuando la variable llega marcada como no.',
};

/** Qué efecto tiene una condición que no se cumple. */
export const CONDITION_SEVERITY_HELP: OptionDescriptions = {
  BLOCKING: 'Si no se cumple, el caso no puede seguir por el camino aprobado.',
  WARNING: 'Si no se cumple, se avisa y se registra, pero el caso sigue.',
  INFO: 'Sólo deja constancia en la traza; no cambia el recorrido.',
};
