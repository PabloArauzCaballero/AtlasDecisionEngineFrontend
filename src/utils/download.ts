/** Client-side file downloads for exports; no backend round trip involved. */

import { resolvePath } from './records';
import { localDateStamp } from '../config/locale';

/**
 * Entrega un `Blob` como archivo.
 *
 * También lo usan las descargas que vienen del motor: se piden con la sesión
 * puesta y se guardan desde memoria, porque un `<a href>` a una ruta de API es
 * una navegación del navegador y ahí no viaja el token —el portal no tiene
 * sesión por cookie— y el servidor responde 401.
 */
export function saveBlob(filename: string, blob: Blob): void {
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, value: unknown): void {
  triggerDownload(
    filename,
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
}

export function downloadCsv(filename: string, content: string): void {
  // The UTF-8 BOM makes Excel decode accented Spanish text correctly.
  triggerDownload(filename, new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' }));
}

export interface CsvColumn {
  key: string;
  label: string;
  /** Dot-notation path for nested backend fields; mirrors the table columns. */
  path?: string;
}

/**
 * Celdas que una hoja de cálculo interpretaría como fórmula.
 *
 * Excel, LibreOffice y Sheets ejecutan el contenido de toda celda que empiece
 * por `=`, `+`, `-` o `@`; los dos controles se cuelan por el mismo sitio porque
 * la hoja los descarta antes de decidir. No es teórico aquí: el valor sale del
 * motor y de catálogos que edita un usuario —códigos de variable, nombres de
 * objetivo, descripciones de motivo—, y `downloadCsv` antepone un BOM
 * precisamente para que el archivo se abra en Excel.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Escapa una celda para CSV y le quita el poder de ejecutarse.
 *
 * Dos problemas distintos con la misma salida:
 *
 * 1. Estructura: comillas, comas y saltos de línea rompen el formato, y se
 *    resuelven entrecomillando y duplicando las comillas.
 * 2. Fórmulas: un `'` inicial —la marca de «esto es texto» que todas las hojas
 *    entienden— impide la ejecución. Va DENTRO del entrecomillado, no fuera:
 *    puesto fuera formaría parte del delimitador y no del valor.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = FORMULA_LEAD.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Serializes rows to CSV following the visible column order, resolving nested paths. */
export function toCsv(
  rows: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[],
): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((column) => escapeCsvCell(column.path ? resolvePath(row, column.path) : row[column.key]))
      .join(','),
  );
  return [header, ...lines].join('\r\n');
}

/** Builds a dated export filename such as `variables-2026-07-17.csv`. */
export function exportFilename(prefix: string, extension: string): string {
  return `${prefix}-${localDateStamp()}.${extension}`;
}
