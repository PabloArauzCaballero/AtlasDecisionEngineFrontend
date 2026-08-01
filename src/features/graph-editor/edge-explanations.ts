import type { UnknownRecord } from '../../utils/records';
import { display } from '../../utils/records';
import type { EdgeRunStatus } from './node-runtime';

/**
 * Explicaciones de las conexiones del grafo.
 *
 * Una arista no dice nada por sí sola: "e3" no explica por qué el caso fue por
 * ahí. Estas funciones convierten lo que el backend guarda de la arista
 * (condiciones, prioridad, si es la rama por defecto) en la frase que el
 * usuario necesita leer: cuándo se toma este camino.
 */

/** Etiqueta corta que se dibuja sobre la conexión. */
export function edgeLabel(edge: UnknownRecord, sourceType: string): string {
  if (sourceType === 'CONDITION') return edge.default ? 'No / defecto' : 'Sí';
  if (sourceType === 'SWITCH') return edge.default ? 'Defecto' : 'Caso';
  return 'Continuar';
}

/**
 * Etiqueta detallada: además del sentido, la regla que gobierna el camino.
 *
 * En el grafo compacto basta "Sí" / "No"; en el detallado el usuario quiere
 * leer el diagrama sin abrir nodos, y para eso necesita ver `Sí · score_buro ≥
 * 700` sobre la propia flecha. La rama "no" muestra la misma regla negada
 * implícitamente, así que no se repite el texto: se marca como "si no".
 */
export function detailedEdgeLabel(
  edge: UnknownRecord,
  sourceType: string,
  rule: string | null,
): string {
  const base = edgeLabel(edge, sourceType);
  if (!rule) return base;
  if (sourceType === 'CONDITION') return edge.default ? `si no · ${rule}` : `si ${rule}`;
  if (sourceType === 'SWITCH' && !edge.default) {
    const value = display(edge, 'caseValue', 'value');
    return value === '—' ? `${rule}` : `${rule} = ${value}`;
  }
  return base;
}

function conditionCodes(edge: UnknownRecord): string[] {
  const raw = edge.conditions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => display(entry as UnknownRecord, 'conditionCode', 'code'))
    .filter((code) => code && code !== '—');
}

const RUNTIME_TEXT: Record<EdgeRunStatus, string> = {
  taken: 'Este es el camino que siguió la ejecución.',
  discarded: 'Este camino se descartó: su condición no se cumplió.',
  pending: 'Todavía no se ha evaluado este camino.',
};

/**
 * Texto completo del tooltip de una conexión: cuándo se usa, qué condiciones la
 * gobiernan y —si se está viendo una ejecución— si se tomó o se descartó.
 */
export function edgeTooltip(
  edge: UnknownRecord,
  sourceType: string,
  runtime?: EdgeRunStatus,
): string {
  const lines: string[] = [`${display(edge, 'from')} → ${display(edge, 'to')}`];

  if (sourceType === 'CONDITION') {
    lines.push(
      edge.default
        ? 'Este camino se utiliza cuando la condición del nodo anterior NO se cumple.'
        : 'Este camino se utiliza cuando la condición del nodo anterior se cumple.',
    );
  } else if (sourceType === 'SWITCH') {
    lines.push(
      edge.default
        ? 'Camino por defecto: se usa cuando ningún caso coincide.'
        : 'Este camino se utiliza cuando el valor coincide con el caso configurado.',
    );
  } else {
    lines.push('Continuación directa: el flujo sigue por aquí sin evaluar ninguna condición.');
  }

  const codes = conditionCodes(edge);
  if (codes.length) lines.push(`Condiciones: ${codes.join(', ')}.`);

  const priority = display(edge, 'priority');
  if (priority !== '—') lines.push(`Prioridad de evaluación: ${priority}.`);
  if (runtime) lines.push(RUNTIME_TEXT[runtime]);

  return lines.join('\n');
}
