import { asRecord, type UnknownRecord } from '../../utils/records';

/**
 * Lector del árbol de expresiones (AST JSON) del motor.
 *
 * Las condiciones y las acciones no guardan `{variable, operador, valor}`, sino
 * un árbol: `{op:'lte', left:{var:'disposable_income'}, right:{value:0}}`, con
 * nodos `and`/`or`/`not`/`if` que anidan otros. Sin leer ese árbol, el editor no
 * podía decir qué variables usa un paso —salía "no lee ninguna variable"— ni
 * mostrar la regla que aplica.
 *
 * El lector es tolerante: recorre lo que reconoce y, ante una forma que no
 * conoce, devuelve lo que haya podido extraer en vez de fallar. Un grafo con una
 * operación nueva del motor debe seguir dibujándose.
 */

/** Hojas del árbol: referencia a variable, valor literal, o nada. */
const VALUE_KEYS = ['value', 'const', 'literal'] as const;

const OPERATOR_TEXT: Record<string, string> = {
  eq: '=',
  neq: '≠',
  ne: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: '∈',
  contains: 'contiene',
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
};

const JOINERS: Record<string, string> = { and: ' y ', or: ' o ' };

/** Nombre corto de una variable: `decision.output.score` → `score`. */
export function shortVariable(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1] || path;
}

/**
 * Todas las variables que aparecen en el árbol, en orden de aparición y sin
 * repetir. Se devuelve la ruta completa: `decision.output.affordability_score`
 * dice que el valor lo produjo un paso anterior, y eso es información útil.
 */
export function astVariables(node: unknown, found = new Set<string>()): string[] {
  if (Array.isArray(node)) {
    for (const entry of node) astVariables(entry, found);
    return [...found];
  }
  if (!node || typeof node !== 'object') return [...found];

  const record = node as UnknownRecord;
  if (typeof record.var === 'string') found.add(record.var);
  // `variable` es la forma antigua, todavía presente en grafos creados a mano
  // desde el editor; se admite para no perder esos casos.
  if (typeof record.variable === 'string') found.add(record.variable);

  for (const [key, child] of Object.entries(record)) {
    if (key === 'var' || key === 'variable') continue;
    astVariables(child, found);
  }
  return [...found];
}

function literal(record: UnknownRecord): string | null {
  for (const key of VALUE_KEYS) {
    if (key in record) {
      const value = record[key];
      if (value === null) return 'nulo';
      if (Array.isArray(value)) return `${value.length} valores`;
      if (typeof value === 'boolean') return value ? 'sí' : 'no';
      if (typeof value === 'object') return '…';
      return String(value);
    }
  }
  return null;
}

/**
 * Texto legible del árbol.
 *
 * Se limita en profundidad a propósito: una expresión de seis niveles no cabe en
 * la tarjeta de un nodo y, resumida a medias, engañaría. A partir del límite se
 * escribe `…`, que es honesto y remite al panel de detalle.
 */
export function astToText(node: unknown, depth = 0): string {
  if (node === null || node === undefined) return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map((entry) => astToText(entry, depth + 1)).join(', ');
  if (depth > 3) return '…';

  const record = node as UnknownRecord;
  if (typeof record.var === 'string') return shortVariable(record.var);
  if (typeof record.variable === 'string') return shortVariable(record.variable);
  const value = literal(record);
  if (value !== null) return value;

  const op = String(record.op ?? record.operator ?? '');
  if (!op) return '…';

  if (op === 'not') return `no ${astToText(record.arg ?? record.args, depth + 1)}`;
  if (op === 'if') {
    const condition = astToText(record.condition, depth + 1);
    return `si ${condition} → ${astToText(record.then, depth + 1)}, si no → ${astToText(
      record.else,
      depth + 1,
    )}`;
  }
  if (JOINERS[op] && Array.isArray(record.args)) {
    return record.args.map((entry) => astToText(entry, depth + 1)).join(JOINERS[op]);
  }
  if ('left' in record || 'right' in record) {
    const symbol = OPERATOR_TEXT[op] ?? op;
    return `${astToText(record.left, depth + 1)} ${symbol} ${astToText(record.right, depth + 1)}`;
  }
  if (Array.isArray(record.args)) {
    const symbol = OPERATOR_TEXT[op] ?? op;
    const separator = OPERATOR_TEXT[op] ? ` ${symbol} ` : ', ';
    const inner = record.args.map((entry) => astToText(entry, depth + 1)).join(separator);
    return OPERATOR_TEXT[op] ? inner : `${op}(${inner})`;
  }
  if ('arg' in record) return `${op}(${astToText(record.arg, depth + 1)})`;

  return op;
}

/** Expresión de una condición del catálogo, sea AST o el formato plano viejo. */
export function conditionExpression(condition: UnknownRecord): unknown {
  const expression = asRecord(condition.expression);
  return Object.keys(expression).length ? expression : null;
}
