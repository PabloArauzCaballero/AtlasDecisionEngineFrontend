import { resolvePath } from '../utils/records';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

/**
 * Utilidades de tabla: orden y búsqueda rápida sobre las filas ya cargadas.
 *
 * Importante y deliberado: ordenar y buscar aquí afecta **sólo a la página que
 * está en pantalla**, no a todo el conjunto del backend. La interfaz lo dice con
 * todas las letras; una tabla que ordenara 25 de 4.000 filas fingiendo ordenar
 * las 4.000 daría una lectura falsa de "los mayores valores".
 */

/** Texto comparable de una celda, resolviendo rutas anidadas. */
export function cellText(row: Record<string, unknown>, key: string, path?: string): string {
  const value = path ? resolvePath(row, path) : row[key];
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const NUMERIC = /^-?\d+([.,]\d+)?$/;

/**
 * Compara dos celdas eligiendo el criterio por su contenido: numérico cuando
 * ambas son números, cronológico cuando ambas son fechas y alfabético en el
 * resto, con las reglas del español (acentos y mayúsculas incluidas).
 */
export function compareCells(left: string, right: string): number {
  if (left === right) return 0;
  // Los huecos van siempre al final, se ordene como se ordene: son ausencia de
  // dato, no un valor "pequeño".
  if (left === '' || left === '—') return 1;
  if (right === '' || right === '—') return -1;

  if (NUMERIC.test(left) && NUMERIC.test(right)) {
    return Number(left.replace(',', '.')) - Number(right.replace(',', '.'));
  }
  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) return leftDate - rightDate;

  return left.localeCompare(right, 'es', { sensitivity: 'base', numeric: true });
}

export interface SortableColumn {
  key: string;
  path?: string;
}

export function sortRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  sort: SortState | null,
  columns: readonly SortableColumn[],
): T[] {
  if (!sort) return [...rows];
  const column = columns.find((entry) => entry.key === sort.key);
  if (!column) return [...rows];
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort(
    (left, right) =>
      factor *
      compareCells(
        cellText(left, column.key, column.path),
        cellText(right, column.key, column.path),
      ),
  );
}

/** Siguiente estado al pulsar una cabecera: asc → desc → sin orden. */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (current?.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

/**
 * Búsqueda rápida sobre las filas visibles. Cada palabra debe aparecer en
 * alguna celda, así que "prod activo" encuentra la fila que cumple las dos
 * cosas aunque estén en columnas distintas.
 */
export function quickFilterRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  query: string,
  columns: readonly SortableColumn[],
): T[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...rows];
  return rows.filter((row) => {
    const haystack = columns
      .map((column) => cellText(row, column.key, column.path))
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
