import type { Option, OptionDescriptions } from './option';
import {
  DATA_TYPE_LABELS,
  SENSITIVITY_CLASSES,
  SENSITIVITY_LABELS,
  TRACE_POLICIES,
  TRACE_POLICY_LABELS,
  type DataType,
} from './data-types';

/**
 * Qué significa cada tipo de dato, clase de sensibilidad y política de traza, y
 * cuándo elegirlo.
 *
 * Son los tres desplegables que más se repiten en el editor (variables de
 * entrada, de salida, intermedias, campos calculados, contrato de salida) y los
 * tres donde una elección equivocada no da error: un importe declarado como
 * «Número decimal» pierde la moneda, y un dato personal marcado «Interno» sale
 * en claro en la traza. La etiqueta sola no bastaba para elegir bien.
 */
export const DATA_TYPE_HELP: Readonly<Record<DataType, string>> = {
  STRING: 'Texto corto de una línea: nombres, códigos de estado, ciudades.',
  LONG_TEXT: 'Texto de varias líneas, como observaciones o descripciones libres.',
  INTEGER: 'Número sin decimales: edades, plazos en meses, conteos.',
  DECIMAL: 'Número con decimales que no es dinero ni porcentaje: ratios, puntajes.',
  BOOLEAN: 'Sólo admite sí o no; para marcas y condiciones cumplidas.',
  DATE: 'Día del calendario sin hora, como la fecha de nacimiento.',
  DATETIME: 'Instante exacto con fecha y hora, como el momento de la solicitud.',
  TIME: 'Hora del día sin fecha, como el inicio de una franja horaria.',
  ENUM: 'Un valor de una lista cerrada que se declara en las restricciones.',
  LIST: 'Varios valores del mismo tipo en orden, como los productos contratados.',
  OBJECT: 'Estructura con claves propias; úsalo cuando el dato tiene partes.',
  IDENTIFIER: 'Referencia a una entidad (cliente, cuenta); no se suma ni se compara.',
  PERCENTAGE: 'Proporción expresada en tanto por ciento, de 0 a 100.',
  CURRENCY: 'Importe de dinero; acompáñalo de la unidad para no mezclar monedas.',
  CODE: 'Código de un catálogo externo, como un país o una actividad económica.',
  STRUCTURED_RESULT: 'Resultado compuesto que devuelve un nodo o un worker entero.',
};

/**
 * Lo mismo, admitiendo los nombres que el motor acepta como alias (`NUMBER`,
 * `ARRAY`, `TEXT`…): algunos formularios los ofrecen tal cual los publica el
 * catálogo de variables y no por el tipo normalizado.
 */
export const DATA_TYPE_HELP_ANY: Readonly<Record<string, string>> = {
  ...DATA_TYPE_HELP,
  NUMBER: 'Número con o sin decimales: importes, puntajes, ratios.',
  ARRAY: DATA_TYPE_HELP.LIST,
  TEXT: DATA_TYPE_HELP.STRING,
};

export const SENSITIVITY_HELP: Readonly<Record<string, string>> = {
  PUBLIC: 'Se puede enseñar a cualquiera, también fuera de la organización.',
  INTERNAL: 'Visible para el personal; no sale de la organización.',
  CONFIDENTIAL: 'Sólo para quien lo necesita en su trabajo; se registra quién lo ve.',
  PII: 'Identifica a una persona (nombre, documento); se enmascara en la traza.',
  SENSITIVE_PII: 'Dato personal de categoría especial (salud, biometría); máxima reserva.',
  SECRET: 'Credencial o clave; nunca se muestra ni se guarda en claro.',
};

export const TRACE_POLICY_HELP: Readonly<Record<string, string>> = {
  FULL: 'La traza guarda el valor tal cual; para datos que no identifican a nadie.',
  MASKED: 'La traza guarda el valor con partes ocultas; se reconoce sin exponerlo.',
  REDACTED: 'La traza sólo guarda que existió y su tipo, nunca el valor.',
  EXCLUDED: 'No aparece en la traza en absoluto; para secretos y credenciales.',
};

const coser = (
  values: readonly string[],
  labels: Readonly<Record<string, string>>,
  help: OptionDescriptions,
): Option[] =>
  values.map((value) => ({ value, label: labels[value] ?? value, description: help[value] }));

export const dataTypeOptions = (types: readonly DataType[]): Option[] =>
  coser(types, DATA_TYPE_LABELS, DATA_TYPE_HELP);

export const sensitivityOptions = (): Option[] =>
  coser(SENSITIVITY_CLASSES, SENSITIVITY_LABELS, SENSITIVITY_HELP);

export const tracePolicyOptions = (): Option[] =>
  coser(TRACE_POLICIES, TRACE_POLICY_LABELS, TRACE_POLICY_HELP);
