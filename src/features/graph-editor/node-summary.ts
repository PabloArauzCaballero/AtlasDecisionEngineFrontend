import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { astToText } from './json-ast';
import { actionMeaning, boundActions, type IoContext } from './node-io';

/**
 * Resumen legible de la REGLA de cada nodo.
 *
 * `node-io.ts` responde "qué datos entran y salen"; esto responde "qué dice
 * exactamente este paso": `score_buro < 550`, `decision = APROBADO`, `→ cola
 * FRAUDE_N2`. Es la línea que convierte un grafo de cajas con nombre en un
 * diagrama que se puede leer sin abrir nodo por nodo.
 *
 * Si la regla no está configurada devuelve `null` y la tarjeta no dibuja nada:
 * un resumen inventado en un nodo a medio configurar es peor que ninguno.
 */

const OPERATORS: Record<string, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: '∈',
  contains: '⊃',
};

/** Valor de comparación en texto corto; las listas se resumen por su tamaño. */
function comparedValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '?';
  if (Array.isArray(value)) return `${value.length} valores`;
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'object') return '…';
  return String(value);
}

/**
 * Regla de una condición del catálogo.
 *
 * El motor guarda un árbol de expresiones (`{op, left:{var}, right:{value}}`),
 * pero el editor manual crea la forma plana `{variable, operator, value}`.
 * Ambas conviven en la misma versión, así que se resuelven las dos: leer sólo
 * una dejaba media mitad de los grafos sin resumen.
 */
export function conditionSummary(condition: UnknownRecord): string | null {
  const expression = asRecord(condition.expression);
  if (!Object.keys(expression).length) return null;

  const variable = display(expression, 'variable');
  if (variable !== '—' && !expression.op) {
    const operator =
      OPERATORS[String(expression.operator ?? '')] ?? String(expression.operator ?? '');
    return `${variable} ${operator} ${comparedValue(expression.value)}`.trim();
  }
  const text = astToText(expression);
  return text && text !== '…' ? text : null;
}

function conditionOf(node: UnknownRecord, conditions: UnknownRecord[]): UnknownRecord | undefined {
  const codes = [
    display(asRecord(node.config), 'conditionCode'),
    ...asRows(node.conditions).map((binding) => display(binding, 'conditionCode', 'code')),
  ].filter((code) => code !== '—');
  return conditions.find((entry) => codes.includes(display(entry, 'code')));
}

export function nodeSummary(node: UnknownRecord, context: IoContext = {}): string | null {
  const config = asRecord(node.config);
  const type = display(node, 'type');

  switch (type) {
    case 'CONDITION': {
      const condition = conditionOf(node, context.conditions ?? []);
      return condition ? conditionSummary(condition) : null;
    }
    case 'SWITCH': {
      const variable = display(config, 'variable');
      return variable === '—' ? null : `según ${variable}`;
    }
    case 'DECISION_TABLE': {
      const rules = asRows(config.rules);
      return rules.length ? `${rules.length} reglas, gana la primera` : null;
    }
    case 'EXPRESSION':
    case 'SCORE': {
      const target = display(config, 'targetVariable');
      const language = display(asRecord(config.script), 'language');
      if (target === '—') return language === '—' ? null : `código ${language}`;
      return `→ ${target}${language === '—' ? '' : ` · ${language}`}`;
    }
    case 'RESULT': {
      const mode = String(config.mode ?? 'MAPPING');
      if (mode === 'REFERENCE') {
        const code = display(config, 'referenceCode', 'artifactCode');
        return code === '—' ? 'llama a otro algoritmo' : `llama a ${code}`;
      }
      if (mode === 'SCRIPT') return 'resultado por código';
      const assignments = asRows(config.assignments);
      if (!assignments.length) return null;
      // Las dos primeras asignaciones son las que identifican el desenlace; el
      // resto se resume, o la tarjeta dejaría de caber.
      const shown = assignments
        .slice(0, 2)
        .map(
          (entry) => `${display(entry, 'outputCode', 'variableCode')} = ${display(entry, 'value')}`,
        )
        .join(' · ');
      return assignments.length > 2 ? `${shown} +${assignments.length - 2}` : shown;
    }
    case 'ACTION': {
      const bound = boundActions(node, context.actions ?? []);
      if (bound.length === 1) return actionMeaning(bound[0]);
      if (bound.length > 1) return `${bound.length} acciones en orden`;
      // Sin catálogo cargado todavía, al menos se nombra lo que el nodo declara.
      const codes = [
        display(config, 'actionCode'),
        ...asRows(node.actions).map((binding) => display(binding, 'actionCode', 'code')),
      ].filter((code) => code !== '—');
      return codes.length ? codes[0] : null;
    }
    case 'MANUAL_REVIEW': {
      const queue = display(config, 'queueCode');
      return queue === '—' ? null : `→ cola ${queue}`;
    }
    default:
      return null;
  }
}

export type NodeBadge = 'terminal' | 'code' | 'reference' | 'human' | 'incomplete';

/**
 * Marcas que resumen el carácter del nodo de un vistazo: si cierra el flujo, si
 * lleva código, si delega en otro algoritmo, si necesita a una persona y si le
 * falta configuración para poder publicarse.
 */
export function nodeBadges(node: UnknownRecord, context: IoContext = {}): NodeBadge[] {
  const config = asRecord(node.config);
  const type = display(node, 'type');
  const badges: NodeBadge[] = [];

  if (node.terminal) badges.push('terminal');
  if (String(asRecord(config.script).source ?? '').trim()) badges.push('code');
  if (String(config.mode ?? '') === 'REFERENCE') badges.push('reference');
  if (type === 'MANUAL_REVIEW') badges.push('human');
  if (!nodeSummary(node, context) && !['START', 'END'].includes(type)) badges.push('incomplete');

  return badges;
}
