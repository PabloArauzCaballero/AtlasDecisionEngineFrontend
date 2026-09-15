import { display, type UnknownRecord } from '../../utils/records';

/** Clave estable y única dentro del nodo, derivada del código del campo. */
export function uniqueCallKey(existing: UnknownRecord[], fieldCode: string): string {
  const base = fieldCode.replace(/[^a-zA-Z0-9_]/g, '_') || 'llamada';
  let candidate = base;
  let index = 2;
  while (existing.some((row) => display(row, 'callKey') === candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
}

/** Un valor fijo tecleado: `true`/`false` y números se guardan con su tipo; el resto, como texto. */
export function parseLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return raw;
}
