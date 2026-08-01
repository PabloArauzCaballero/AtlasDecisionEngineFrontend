import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { astToText, astVariables, shortVariable } from '../graph-editor/json-ast';
import { actionMeaning } from '../graph-editor/node-io';

/** Una versión del motor con su grafo ya cargado. */
export interface VersionGraph {
  versionId: string;
  artifactCode: string;
  artifactName: string;
  semanticVersion: string;
  status: string;
  actions: UnknownRecord[];
  nodes: UnknownRecord[];
}

/** Dónde vive una acción y qué pasos la ejecutan allí. */
export interface BankOrigin {
  versionId: string;
  artifactCode: string;
  semanticVersion: string;
  status: string;
  nodes: string[];
  /** Huella de la definición en esa versión, para detectar divergencias. */
  fingerprint: string;
}

export interface BankEntry extends Record<string, unknown> {
  code: string;
  type: string;
  implies: string;
  expression: string;
  reads: string;
  writes: string;
  reasons: string;
  terminal: string;
  /** Algoritmos que declaran la acción. */
  algorithms: string;
  /** Pasos que la ejecutan, de todos los algoritmos. */
  usedBy: string;
  /** `DIVERGE` cuando el mismo código significa cosas distintas según el algoritmo. */
  consistency: string;
  origins: BankOrigin[];
  source: UnknownRecord;
}

/**
 * Huella de una definición de acción.
 *
 * Compara lo que cambia el comportamiento —tipo, payload, terminalidad y motivos
 * emitidos— e ignora el `id` que el motor asigna por versión. Dos acciones con el
 * mismo código y distinta huella son una incoherencia de gobierno: el mismo
 * nombre significa cosas distintas según el algoritmo que lo ejecute.
 */
export function actionFingerprint(action: UnknownRecord): string {
  return JSON.stringify({
    type: display(action, 'type'),
    payload: asRecord(action.payload),
    terminal: Boolean(action.terminal),
    reasonCodes: asRows(action.reasonCodes)
      .map((reason) => display(reason, 'code'))
      .sort(),
  });
}

/** Los campos descriptivos de una acción, compartidos por banco y detalle. */
function describe(action: UnknownRecord) {
  const payload = asRecord(action.payload);
  return {
    type: display(action, 'type'),
    implies: actionMeaning(action),
    expression: payload.valueExpression ? astToText(payload.valueExpression) : '',
    reads: astVariables(payload).map(shortVariable).join(', '),
    writes: display(payload, 'field', 'queueCode'),
    reasons: asRows(action.reasonCodes)
      .map((reason) => display(reason, 'code'))
      .join(', '),
    terminal: action.terminal ? 'CIERRA EL FLUJO' : 'CONTINÚA',
  };
}

/** Pasos de un grafo que ejecutan una acción concreta. */
function usersOf(code: string, nodes: UnknownRecord[]): string[] {
  return nodes
    .filter((node) =>
      asRows(node.actions).some((binding) => display(binding, 'actionCode', 'code') === code),
    )
    .map((node) => display(node, 'label', 'key'));
}

/**
 * Une las acciones de todas las versiones en un banco único.
 *
 * El motor las guarda por versión (`decision_rule_action` es único por
 * `artifact_version_id + action_code`), así que el banco es una vista: agrupa por
 * código y conserva la procedencia. Eso permite lo que hacía falta —ver el
 * repertorio completo sin elegir un algoritmo, y reutilizar una acción en otro—
 * y además saca a la luz lo que la forma por versión esconde: el mismo código
 * definido de dos maneras distintas.
 */
export function toActionBank(graphs: VersionGraph[]): BankEntry[] {
  const byCode = new Map<string, BankEntry>();

  for (const graph of graphs) {
    for (const action of graph.actions) {
      const code = display(action, 'code');
      if (code === '—') continue;
      const origin: BankOrigin = {
        versionId: graph.versionId,
        artifactCode: graph.artifactCode,
        semanticVersion: graph.semanticVersion,
        status: graph.status,
        nodes: usersOf(code, graph.nodes),
        fingerprint: actionFingerprint(action),
      };
      const existing = byCode.get(code);
      if (existing) {
        existing.origins.push(origin);
        continue;
      }
      byCode.set(code, {
        code,
        ...describe(action),
        algorithms: '',
        usedBy: '',
        consistency: '',
        origins: [origin],
        source: action,
      });
    }
  }

  return [...byCode.values()]
    .map((entry) => ({
      ...entry,
      algorithms: entry.origins
        .map((origin) => `${origin.artifactCode} ${origin.semanticVersion}`)
        .join(', '),
      usedBy: [...new Set(entry.origins.flatMap((origin) => origin.nodes))].join(', '),
      consistency:
        new Set(entry.origins.map((origin) => origin.fingerprint)).size > 1
          ? 'DIVERGE'
          : 'COINCIDE',
    }))
    .sort((left, right) => left.code.localeCompare(right.code, 'es'));
}

export interface BankFilters {
  search: string;
  type: string;
  /** `usadas`, `huerfanas` o vacío. */
  usage: string;
  /** Código de artefacto, o vacío para todos. */
  algorithm: string;
  /** `diverge` para quedarse sólo con las incoherentes. */
  consistency: string;
}

export const EMPTY_BANK_FILTERS: BankFilters = {
  search: '',
  type: '',
  usage: '',
  algorithm: '',
  consistency: '',
};

export function filterBank(entries: BankEntry[], filters: BankFilters): BankEntry[] {
  const needle = filters.search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.type && entry.type !== filters.type) return false;
    if (filters.usage === 'usadas' && !entry.usedBy) return false;
    if (filters.usage === 'huerfanas' && entry.usedBy) return false;
    if (filters.consistency === 'diverge' && entry.consistency !== 'DIVERGE') return false;
    if (
      filters.algorithm &&
      !entry.origins.some((origin) => origin.artifactCode === filters.algorithm)
    ) {
      return false;
    }
    if (!needle) return true;
    return `${entry.code} ${entry.implies} ${entry.expression} ${entry.reads} ${entry.writes} ${entry.reasons} ${entry.algorithms}`
      .toLowerCase()
      .includes(needle);
  });
}

/** Opciones presentes en el banco, para no ofrecer filtros que no filtran nada. */
export function bankOptions(entries: BankEntry[]) {
  return {
    types: [...new Set(entries.map((entry) => entry.type))].filter((type) => type !== '—').sort(),
    algorithms: [
      ...new Set(entries.flatMap((entry) => entry.origins.map((origin) => origin.artifactCode))),
    ].sort(),
  };
}
