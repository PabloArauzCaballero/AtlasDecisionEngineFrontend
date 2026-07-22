import { Eye } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from './StatusBadge';

export interface TableColumn<T> {
  key: keyof T & string;
  label: string;
  mono?: boolean;
  status?: boolean;
}

interface DataTableProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: readonly TableColumn<T>[];
  getRowKey: (row: T) => string;
  detailPath?: (row: T) => string;
}

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  getRowKey,
  detailPath,
}: DataTableProps<T>) {
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
              </th>
            ))}
            {detailPath ? <th scope="col">Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.mono ? 'mono' : undefined}>
                  {column.status ? (
                    <StatusBadge value={row[column.key]} />
                  ) : (
                    formatValue(row[column.key])
                  )}
                </td>
              ))}
              {detailPath ? (
                <td>
                  <Link className="table-action" href={detailPath(row)} aria-label="Ver detalle">
                    <Eye size={16} />
                  </Link>
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
