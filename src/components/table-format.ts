import { formatDateTime } from '../config/locale';

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Texto de una celda de tabla.
 *
 * Vive aparte de `DataTable` para que la tabla quepa en el presupuesto de 299
 * líneas del repositorio y para poder probar el formato sin renderizar nada.
 *
 * Las fechas ISO se muestran en formato local: un `2026-07-27T13:52:57.920Z` no
 * es legible de un vistazo, y la mitad de las columnas del portal son fechas.
 */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && ISO_DATETIME.test(value)) {
    const formatted = formatDateTime(value);
    if (formatted !== '—') return formatted;
  }
  return String(value);
}
