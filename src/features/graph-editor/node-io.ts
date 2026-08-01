import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { astVariables, shortVariable } from './json-ast';

export interface NodeIo {
  /** Variables de ENTRADA que este paso lee. */
  reads: string[];
  /** Variables de SALIDA que este paso escribe. */
  writes: string[];
  /** Qué hace el paso, en una frase; `null` si su tipo no ejecuta nada. */
  action: string | null;
}

/**
 * Qué lee y qué escribe cada nodo del grafo.
 *
 * Todo sale de la misma configuración que ya guarda el grafo; no se pide nada
 * nuevo al backend. Las condiciones y las acciones del motor guardan su lógica
 * como un árbol de expresiones (`json-ast.ts`), así que las variables se
 * extraen recorriéndolo: leer sólo el nivel superior era lo que hacía que todos
 * los nodos dijeran "no lee ninguna variable".
 *
 * Es deliberadamente conservador: si un dato no está declarado, no aparece. Un
 * listado inventado sería peor que uno corto, porque el usuario lo tomaría por
 * el contrato real del paso.
 */

/** Variables que un script lee, buscando los accesos a `variables` en el código. */
export function scriptReads(source: string): string[] {
  const found = new Set<string>();
  // Cubre las tres formas admitidas: `variables.x`, `variables["x"]` (JS) y
  // `variables.get("x")` (Python).
  const patterns = [
    /variables\.get\(\s*['"]([A-Za-z_][\w]*)['"]\s*\)/g,
    /variables\[\s*['"]([A-Za-z_][\w]*)['"]\s*\]/g,
    /variables\.([A-Za-z_][\w]*)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== 'get') found.add(match[1]);
    }
  }
  return [...found];
}

function unique(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value) && value !== '—'))];
}

export interface IoContext {
  /** Catálogo de condiciones del grafo (`snapshot.conditions`). */
  conditions?: UnknownRecord[];
  /** Catálogo de acciones del grafo (`snapshot.actions`). */
  actions?: UnknownRecord[];
  /** Variables declaradas de la versión (`snapshot.variables`). */
  variables?: UnknownRecord[];
}

/** Códigos de condición vinculados al nodo, por configuración o por binding. */
function conditionCodes(node: UnknownRecord): string[] {
  return unique([
    display(asRecord(node.config), 'conditionCode'),
    ...asRows(node.conditions).map((binding) => display(binding, 'conditionCode', 'code')),
  ]);
}

/** Definiciones de las acciones que ejecuta el nodo, en su orden de ejecución. */
export function boundActions(node: UnknownRecord, actions: UnknownRecord[]): UnknownRecord[] {
  const codes = unique([
    display(asRecord(node.config), 'actionCode'),
    ...asRows(node.actions).map((binding) => display(binding, 'actionCode', 'code')),
  ]);
  return codes
    .map((code) => actions.find((entry) => display(entry, 'code') === code))
    .filter((entry): entry is UnknownRecord => Boolean(entry));
}

/** Variables que lee una acción: las que aparecen en su expresión de valor. */
function actionReads(definition: UnknownRecord): string[] {
  return astVariables(definition.payload).map(shortVariable);
}

/** Variable que escribe una acción, más los motivos que emite. */
function actionWrites(definition: UnknownRecord): string[] {
  const field = display(asRecord(definition.payload), 'field', 'target', 'output');
  const reasons = asRows(definition.reasonCodes).map((reason) => display(reason, 'code'));
  return unique([field === '—' ? undefined : field, ...reasons]);
}

const ACTION_TEXT: Record<string, string> = {
  SET_FIELD: 'calcula y escribe un valor',
  EMIT_REASON: 'emite un motivo explicable',
  CREATE_MANUAL_REVIEW: 'abre un caso de revisión manual',
  REJECT: 'rechaza la solicitud',
  APPROVE: 'aprueba la solicitud',
};

/** Qué implica una acción, en lenguaje de negocio. */
export function actionMeaning(definition: UnknownRecord): string {
  const type = display(definition, 'type');
  const base = ACTION_TEXT[type] ?? `ejecuta ${type}`;
  const field = display(asRecord(definition.payload), 'field');
  if (type === 'SET_FIELD' && field !== '—') return `${base}: ${field}`;
  const reasons = asRows(definition.reasonCodes).map((reason) => display(reason, 'code'));
  if (reasons.length) return `${base}: ${reasons.join(', ')}`;
  return base;
}

function conditionIo(node: UnknownRecord, conditions: UnknownRecord[]): NodeIo {
  const codes = conditionCodes(node);
  const bound = conditions.filter((entry) => codes.includes(display(entry, 'code')));
  const reads = unique(bound.flatMap((entry) => astVariables(entry.expression).map(shortVariable)));
  return {
    reads,
    writes: [],
    action: reads.length
      ? `Evalúa ${reads.join(', ')} y elige la rama sí / no.`
      : 'Divide el flujo, pero todavía no tiene una condición configurada.',
  };
}

function actionIo(node: UnknownRecord, actions: UnknownRecord[]): NodeIo {
  const bound = boundActions(node, actions);
  if (!bound.length) {
    // Apuntar a una acción inexistente y no tener ninguna son dos problemas
    // distintos, y se arreglan de forma distinta: hay que decir cuál es.
    const declared = unique([
      display(asRecord(node.config), 'actionCode'),
      ...asRows(node.actions).map((binding) => display(binding, 'actionCode', 'code')),
    ]);
    return {
      reads: [],
      writes: [],
      action: declared.length
        ? `Ejecuta la acción ${declared[0]}, que todavía no está definida en este grafo.`
        : 'Todavía no tiene una acción asignada.',
    };
  }
  return {
    reads: unique(bound.flatMap(actionReads)),
    writes: unique(bound.flatMap(actionWrites)),
    action:
      bound.length === 1
        ? `Ejecuta ${display(bound[0], 'code')}: ${actionMeaning(bound[0])}.`
        : `Ejecuta ${bound.length} acciones en orden: ${bound
            .map((entry) => display(entry, 'code'))
            .join(' → ')}.`,
  };
}

export function nodeIo(node: UnknownRecord, context: IoContext = {}): NodeIo {
  const config = asRecord(node.config);
  const type = display(node, 'type');
  const source = String(asRecord(config.script).source ?? '');

  switch (type) {
    case 'CONDITION':
      return conditionIo(node, context.conditions ?? []);
    case 'ACTION':
      return actionIo(node, context.actions ?? []);
    case 'SWITCH': {
      const variable = display(config, 'variable');
      return {
        reads: unique([variable]),
        writes: [],
        action: variable !== '—' ? `Enruta según el valor de «${variable}».` : null,
      };
    }
    case 'DECISION_TABLE': {
      const rules = asRows(config.rules);
      return {
        reads: unique(rules.map((rule) => display(rule, 'variable'))),
        writes: [],
        action: `Evalúa ${rules.length} regla(s) de arriba abajo; gana la primera que coincide.`,
      };
    }
    case 'EXPRESSION':
    case 'SCORE': {
      const target = display(config, 'targetVariable');
      return {
        reads: scriptReads(source),
        writes: unique([target]),
        action: source
          ? `Calcula con código ${display(asRecord(config.script), 'language')}${
              target !== '—' ? ` y escribe «${target}»` : ''
            }.`
          : 'Todavía no tiene código escrito.',
      };
    }
    case 'RESULT': {
      const mode = String(config.mode ?? 'MAPPING');
      const assignments = asRows(config.assignments);
      const writes = unique(
        assignments.map((entry) => display(entry, 'outputCode', 'variableCode')),
      );
      const fromActions = actionIo(node, context.actions ?? []);
      if (mode === 'REFERENCE') {
        const outputs = asRows(config.outputMappings ?? config.outputs);
        return {
          reads: unique(
            asRows(config.inputMappings).map((entry) => display(entry, 'variableCode')),
          ),
          writes: unique([...writes, ...outputs.map((entry) => display(entry, 'variableCode'))]),
          action: `Invoca el algoritmo ${display(config, 'referenceCode', 'artifactCode')} y usa lo que devuelve.`,
        };
      }
      // Un RESULT del motor cierra el flujo ejecutando acciones vinculadas; el
      // creado a mano en el editor usa asignaciones. Se admiten los dos.
      if (!writes.length && fromActions.writes.length) return fromActions;
      return {
        reads: mode === 'SCRIPT' ? scriptReads(source) : [],
        writes,
        action:
          mode === 'SCRIPT'
            ? 'Calcula el resultado final con código.'
            : `Fija el resultado final asignando ${writes.length} variable(s) de salida.`,
      };
    }
    case 'MANUAL_REVIEW': {
      const queue = display(config, 'queueCode');
      return {
        reads: [],
        writes: [],
        action:
          queue !== '—'
            ? `Deriva el caso a la cola «${queue}» para que lo resuelva una persona.`
            : 'Deriva el caso a una persona (falta indicar la cola).',
      };
    }
    case 'START': {
      // El inicio recibe TODAS las variables de entrada declaradas: decir "no
      // lee ninguna" era falso y desconcertaba a quien abría el primer nodo.
      const inputs = (context.variables ?? []).filter(
        (variable) => !String(variable.usageType ?? 'INPUT').startsWith('OUTPUT'),
      );
      const reads = unique(inputs.map((variable) => display(variable, 'code', 'variableCode')));
      return {
        reads,
        writes: [],
        action: reads.length
          ? `Recibe las ${reads.length} variables de entrada declaradas por la versión.`
          : 'Recibe las variables de entrada. La versión todavía no declara ninguna.',
      };
    }
    case 'END':
      return { reads: [], writes: [], action: 'Cierra el flujo sin producir un resultado.' };
    default:
      return { reads: [], writes: [], action: null };
  }
}
