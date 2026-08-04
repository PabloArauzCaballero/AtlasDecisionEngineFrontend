import { asRows, type UnknownRecord } from '../../utils/records';

/**
 * Comparación estructural entre dos versiones de un artefacto.
 *
 * No es un diff textual: el grafo llega como JSON con identificadores estables
 * (`nodes[].key`, `edges[].key`, `actions[].code`…), así que comparar el texto
 * marcaría como cambio un reordenamiento del arreglo y perdería el cambio real.
 * Aquí se indexa cada colección por su identificador de dominio y se comparan
 * campo a campo, produciendo rutas legibles del estilo `nodes.EVAL_SCORE.label`.
 *
 * Es de sólo lectura y se calcula en el cliente: responde «qué cambió» sin
 * necesitar ningún endpoint nuevo. Resolver un conflicto —elegir un valor y
 * escribirlo— sí requeriría backend, y por eso no se ofrece aquí.
 */

export type ChangeKind = 'added' | 'removed' | 'changed';

interface CollectionSpec {
  key: string;
  label: string;
  /** Campos candidatos a identificador estable, en orden de preferencia. */
  idFields: readonly string[];
}

/** Colecciones del grafo y con qué campo se identifica cada elemento. */
const COLLECTIONS: readonly CollectionSpec[] = [
  { key: 'nodes', label: 'Nodos', idFields: ['key', 'code', 'id'] },
  { key: 'edges', label: 'Conexiones', idFields: ['key', 'id'] },
  { key: 'conditions', label: 'Condiciones', idFields: ['code', 'id'] },
  { key: 'actions', label: 'Acciones', idFields: ['code', 'id'] },
  { key: 'variables', label: 'Variables', idFields: ['code', 'variableVersionId', 'id'] },
  { key: 'intermediates', label: 'Variables intermedias', idFields: ['code', 'id'] },
  { key: 'outputContract', label: 'Contrato de salida', idFields: ['code', 'id'] },
];

/**
 * Campos que sólo mueven el dibujo. Se informan igual —ocultar un cambio es
 * mentir— pero marcados, para que el revisor no los confunda con lógica.
 */
const COSMETIC_FIELDS = new Set(['x', 'y', 'order', 'priority', 'updatedAt', 'createdAt']);

export interface DiffEntry {
  path: string;
  collection: string;
  collectionLabel: string;
  entityId: string;
  /** `null` cuando el elemento entero se añadió o se quitó. */
  field: string | null;
  kind: ChangeKind;
  before: string | null;
  after: string | null;
  cosmetic: boolean;
}

export interface GraphDiff {
  entries: DiffEntry[];
  /** Cambios que alteran la decisión, es decir todo lo no cosmético. */
  substantive: DiffEntry[];
  counts: Record<ChangeKind, number>;
  /** `true` cuando ninguna de las dos versiones trae colecciones comparables. */
  empty: boolean;
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function identify(row: UnknownRecord, idFields: readonly string[], index: number): string {
  for (const field of idFields) {
    const value = row[field];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  // Sin identificador estable no se puede emparejar; la posición es lo único
  // que queda, y se marca para que la ruta no aparente más precisión de la que hay.
  return `#${index}`;
}

function indexRows(source: UnknownRecord, spec: CollectionSpec): Map<string, UnknownRecord> {
  const map = new Map<string, UnknownRecord>();
  asRows(source[spec.key]).forEach((row, index) => {
    map.set(identify(row, spec.idFields, index), row);
  });
  return map;
}

function entry(
  spec: CollectionSpec,
  entityId: string,
  field: string | null,
  kind: ChangeKind,
  before: string | null,
  after: string | null,
): DiffEntry {
  return {
    path: field ? `${spec.key}.${entityId}.${field}` : `${spec.key}.${entityId}`,
    collection: spec.key,
    collectionLabel: spec.label,
    entityId,
    field,
    kind,
    before,
    after,
    cosmetic: field !== null && COSMETIC_FIELDS.has(field),
  };
}

/** Campos presentes en cualquiera de las dos versiones del elemento. */
function fieldsOf(before: UnknownRecord, after: UnknownRecord): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
}

function compareEntity(
  spec: CollectionSpec,
  entityId: string,
  before: UnknownRecord,
  after: UnknownRecord,
): DiffEntry[] {
  const changes: DiffEntry[] = [];
  for (const field of fieldsOf(before, after)) {
    const left = stringify(before[field]);
    const right = stringify(after[field]);
    if (left === right) continue;
    changes.push(entry(spec, entityId, field, 'changed', left, right));
  }
  return changes;
}

/**
 * Compara dos instantáneas de grafo. `base` es la versión de referencia y
 * `target` la propuesta: «añadido» significa que existe en `target` y no en `base`.
 */
export function diffGraphs(base: unknown, target: unknown): GraphDiff {
  const left = (base ?? {}) as UnknownRecord;
  const right = (target ?? {}) as UnknownRecord;
  const entries: DiffEntry[] = [];
  let comparable = false;

  for (const spec of COLLECTIONS) {
    const before = indexRows(left, spec);
    const after = indexRows(right, spec);
    if (!before.size && !after.size) continue;
    comparable = true;

    for (const [id, row] of after) {
      if (!before.has(id)) entries.push(entry(spec, id, null, 'added', null, stringify(row)));
    }
    for (const [id, row] of before) {
      if (!after.has(id)) entries.push(entry(spec, id, null, 'removed', stringify(row), null));
      else entries.push(...compareEntity(spec, id, row, after.get(id) as UnknownRecord));
    }
  }

  const counts: Record<ChangeKind, number> = { added: 0, removed: 0, changed: 0 };
  for (const change of entries) counts[change.kind] += 1;

  return {
    entries,
    substantive: entries.filter((change) => !change.cosmetic),
    counts,
    empty: !comparable,
  };
}

/** Agrupa los cambios por colección, conservando el orden del catálogo. */
export function groupByCollection(diff: GraphDiff): { label: string; entries: DiffEntry[] }[] {
  return COLLECTIONS.map((spec) => ({
    label: spec.label,
    entries: diff.entries.filter((change) => change.collection === spec.key),
  })).filter((group) => group.entries.length > 0);
}
