/**
 * Qué comparaciones tienen sentido según el tipo del dato.
 *
 * El editor ofrecía SIEMPRE la misma lista —«mayor o igual» incluido— y arrancaba
 * en `gte` aunque la variable fuera un texto. Preguntar si un estado de KYC es
 * «mayor o igual» que otro no significa nada para quien escribe la regla, y en
 * JavaScript compara alfabéticamente, de modo que la condición se guarda, se
 * publica y decide por un criterio que nadie quiso.
 *
 * Todos los operadores de aquí los evalúa el motor (`expression-evaluator`): no
 * se ofrece nada que el backend no sepa ejecutar.
 */
export type OperatorId =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'starts_with'
  | 'ends_with';

export const OPERATOR_LABELS: Readonly<Record<OperatorId, string>> = {
  eq: 'Es igual a',
  neq: 'Es distinto de',
  gt: 'Mayor que',
  gte: 'Mayor o igual que',
  lt: 'Menor que',
  lte: 'Menor o igual que',
  in: 'Está en la lista',
  not_in: 'No está en la lista',
  contains: 'Contiene',
  starts_with: 'Empieza por',
  ends_with: 'Termina en',
};

const NUMERIC_TYPES = new Set(['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'FLOAT', 'PERCENTAGE']);
const TEMPORAL_TYPES = new Set(['DATE', 'DATETIME', 'TIMESTAMP']);
const TEXT_TYPES = new Set(['STRING', 'TEXT', 'ENUM']);

/** Familia de comparación a la que pertenece un tipo declarado. */
export type OperatorFamily = 'NUMERIC' | 'TEMPORAL' | 'TEXT' | 'BOOLEAN' | 'LIST' | 'UNKNOWN';

export function familyOf(dataType: string): OperatorFamily {
  const type = dataType.toUpperCase();
  if (NUMERIC_TYPES.has(type)) return 'NUMERIC';
  if (TEMPORAL_TYPES.has(type)) return 'TEMPORAL';
  if (TEXT_TYPES.has(type)) return 'TEXT';
  if (type === 'BOOLEAN' || type === 'BOOL') return 'BOOLEAN';
  if (type === 'LIST' || type === 'ARRAY') return 'LIST';
  return 'UNKNOWN';
}

const BY_FAMILY: Readonly<Record<OperatorFamily, readonly OperatorId[]>> = {
  // El orden y el «mayor que» son legítimos aquí y sólo aquí.
  NUMERIC: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in'],
  // Una fecha se ordena igual que un número: antes/después es «menor/mayor».
  TEMPORAL: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  // Un texto no se ordena: se compara, se busca dentro o se mira si está en una
  // lista de valores permitidos. Es lo que de verdad se quiere preguntar.
  TEXT: ['eq', 'neq', 'contains', 'starts_with', 'ends_with', 'in', 'not_in'],
  // Un booleano sólo puede ser lo uno o lo otro.
  BOOLEAN: ['eq', 'neq'],
  // De una lista se pregunta si contiene algo.
  LIST: ['contains'],
  // Sin tipo declarado no se adivina: se ofrece todo y decide quien edita.
  UNKNOWN: [
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'not_in',
    'contains',
    'starts_with',
    'ends_with',
  ],
};

export function operatorsFor(dataType: string): readonly OperatorId[] {
  return BY_FAMILY[familyOf(dataType)];
}

/**
 * Operador de partida. `gte` sólo tiene sentido donde hay orden; en texto y
 * booleano la pregunta natural es la igualdad, y en una lista, la pertenencia.
 */
export function defaultOperatorFor(dataType: string): OperatorId {
  const family = familyOf(dataType);
  if (family === 'NUMERIC' || family === 'TEMPORAL') return 'gte';
  if (family === 'LIST') return 'contains';
  return 'eq';
}

/** ¿Este operador aplica a este tipo? Sirve para no dejar una condición inválida. */
export function isOperatorValidFor(dataType: string, operator: string): boolean {
  return (operatorsFor(dataType) as readonly string[]).includes(operator);
}

/** Los que comparan contra una LISTA de valores, no contra un valor suelto. */
export function expectsList(operator: string): boolean {
  return operator === 'in' || operator === 'not_in';
}

/** Los que comparan contra un texto aunque la variable no sea de texto. */
export function expectsText(operator: string): boolean {
  return operator === 'contains' || operator === 'starts_with' || operator === 'ends_with';
}

/**
 * Una comparación simple, sea cual sea la forma en que esté guardada.
 *
 * Hay DOS formas en circulación y ambas las evalúa el motor: la plana que
 * escribe este editor (`{variable, operator, value}`) y la de árbol que producen
 * el compilador y los seeders (`{op, left: {var}, right: {value}}`). El editor
 * sólo sabía leer la primera, así que al abrir una condición sembrada mostraba
 * todos los campos VACÍOS y parecía que no estuviera configurada — cuando lo
 * estaba, y decidía correctamente.
 *
 * Devuelve `null` cuando la expresión no es una comparación simple (un `or` de
 * varias, un `not`…): ahí no hay tres campos que enseñar, y fingir que sí los
 * hay es peor que decirlo.
 */
export interface SimpleComparison {
  variable: string;
  operator: string;
  value: unknown;
}

function asRecordLike(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readComparison(expression: unknown): SimpleComparison | null {
  const node = asRecordLike(expression);
  if (!node) return null;

  // Forma plana: la que escribe este editor.
  if (typeof node.variable === 'string' && typeof node.operator === 'string') {
    return { variable: node.variable, operator: node.operator, value: node.value };
  }

  // Forma de árbol: la del compilador y los seeders.
  if (typeof node.op === 'string') {
    const left = asRecordLike(node.left);
    const right = asRecordLike(node.right);
    if (left && typeof left.var === 'string' && right && 'value' in right) {
      return { variable: left.var, operator: node.op, value: right.value };
    }
    // `{ var: 'x' }` a secas es «x es verdadero», que en la forma plana se dice
    // comparando con true. Es como se guardan las banderas booleanas.
    if (typeof node.var === 'string') {
      return { variable: node.var, operator: 'eq', value: true };
    }
  }

  if (typeof node.var === 'string') {
    return { variable: node.var, operator: 'eq', value: true };
  }

  return null;
}

/** ¿Hay algo guardado que este editor no puede representar con tres campos? */
export function isComposite(expression: unknown): boolean {
  const node = asRecordLike(expression);
  if (!node || Object.keys(node).length === 0) return false;
  return readComparison(expression) === null;
}
