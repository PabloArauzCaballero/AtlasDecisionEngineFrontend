export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function asRows(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

/**
 * Reads a dot-notation path into a nested record, e.g.
 * 'artifactVersion.artifact.artifactCode'. Returns undefined if any hop is
 * missing. Shared by the table renderer and the CSV exporter so both surface
 * the same nested backend fields.
 */
export function resolvePath(row: UnknownRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as UnknownRecord)[key];
    return undefined;
  }, row);
}

export function display(record: UnknownRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== '') {
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
  return '—';
}
