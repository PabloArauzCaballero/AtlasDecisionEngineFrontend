import { resolvePath } from '../utils/records';
import { ActionIcon } from './ActionIcon';
import type { ActionKey } from './action-catalog';
import { InfoHint } from './InfoHint';
import { StatusBadge } from './StatusBadge';

export interface TableColumn<T> {
  key: keyof T & string;
  label: string;
  mono?: boolean;
  status?: boolean;
  /**
   * Dot-notation path into the row for nested or renamed backend fields, e.g.
   * 'artifactVersion.artifact.artifactCode'. When set it overrides `key` as the
   * value source (`key` stays the stable React/column identifier).
   */
  path?: string;
  /** Plain-language explanation of the column, shown as a ? in the header. */
  hint?: string;
}

export interface RowAction {
  action: ActionKey;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Texto accesible especializado (recomendado sobre el genérico del catálogo). */
  label?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: readonly TableColumn<T>[];
  getRowKey: (row: T) => string;
  detailPath?: (row: T) => string;
  /** Acciones por fila con iconos del catálogo. Tiene prioridad sobre detailPath. */
  rowActions?: (row: T) => RowAction[];
}

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  getRowKey,
  detailPath,
  rowActions,
}: DataTableProps<T>) {
  const hasActions = Boolean(rowActions) || Boolean(detailPath);
  if (!rows.length) {
    return (
      <div className="empty-state">
        <p>No hay registros para los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
                {column.hint ? (
                  <InfoHint text={column.hint} label={`Qué es: ${column.label}`} />
                ) : null}
              </th>
            ))}
            {hasActions ? <th scope="col">Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => {
                const value = column.path ? resolvePath(row, column.path) : row[column.key];
                return (
                  <td key={column.key} className={column.mono ? 'mono' : undefined}>
                    {column.status ? <StatusBadge value={value} /> : formatValue(value)}
                  </td>
                );
              })}
              {hasActions ? (
                <td>
                  <div className="action-row">
                    {rowActions ? (
                      rowActions(row).map((rowAction, index) => (
                        <ActionIcon key={`${rowAction.action}-${index}`} {...rowAction} />
                      ))
                    ) : detailPath ? (
                      <ActionIcon action="view" href={detailPath(row)} />
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && ISO_DATETIME.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('es', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return String(value);
}
