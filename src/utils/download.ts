/** Client-side file downloads for exports; no backend round trip involved. */

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
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Serializes rows to CSV following the visible column order. */
export function toCsv(
  rows: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[],
): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column.key])).join(','),
  );
  return [header, ...lines].join('\r\n');
}

/** Builds a dated export filename such as `variables-2026-07-17.csv`. */
export function exportFilename(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${extension}`;
}
