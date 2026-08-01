import type { CreateField } from './resource.types';

export type FieldValue = string | boolean;

/** Uppercases and strips to [A-Z0-9_-] as the user types (stable resource codes). */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

/** Seeds the form state: checkboxes to their boolean default, others to text. */
export function initialValues(fields: readonly CreateField[]): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    values[field.key] =
      field.kind === 'checkbox'
        ? Boolean(field.defaultValue ?? false)
        : typeof field.defaultValue === 'string'
          ? field.defaultValue
          : '';
  }
  return values;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-clones plain objects/arrays so a config's static body is never mutated. */
function clone<T>(value: T): T {
  return isObject(value) || Array.isArray(value) ? (JSON.parse(JSON.stringify(value)) as T) : value;
}

/** Sets a possibly dotted key (`initialVersion.dataType`) into a nested object. */
function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!isObject(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

/**
 * Interpreta el texto de un campo `json` como valor tipado.
 *
 * Una cadena suelta (`aprobado`) no es JSON válido pero es exactamente lo que un
 * analista escribe como ejemplo de una variable de texto, así que se acepta tal
 * cual en vez de obligarle a entrecomillar. Lo que NO se acepta es un JSON a
 * medias (`{"min":`), porque ahí la intención era claramente estructurada y
 * mandarlo como cadena lo convertiría en un 422 sin explicación.
 */
export function parseJsonFieldValue(text: string): { valid: boolean; value: unknown } {
  try {
    return { valid: true, value: JSON.parse(text) };
  } catch {
    const looksStructured = /^[[{]|^-?\d/.test(text);
    return { valid: !looksStructured, value: text };
  }
}

/** Campos `json` cuyo texto está a medias, por clave. Vacío = se puede enviar. */
export function jsonFieldErrors(
  fields: readonly CreateField[],
  values: Record<string, FieldValue>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.kind !== 'json') continue;
    const text = String(values[field.key] ?? '').trim();
    if (!text) continue;
    if (!parseJsonFieldValue(text).valid) {
      errors[field.key] = `«${field.label}» no es un JSON válido.`;
    }
  }
  return errors;
}

/**
 * Builds the POST body from the declared fields. Field keys mirror the resource
 * DTO (dot-notation nests, e.g. `initialVersion.dataType`); optional empty text
 * fields are omitted so the backend applies its own defaults. `staticBody`
 * supplies constant required values (such as empty arrays) beneath the form.
 */
export function buildPayload(
  fields: readonly CreateField[],
  values: Record<string, FieldValue>,
  staticBody?: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = staticBody ? clone(staticBody) : {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.kind === 'checkbox') {
      setPath(payload, field.key, Boolean(value));
      continue;
    }
    const text = String(value).trim();
    if (!text && !field.required) continue;
    setPath(payload, field.key, field.kind === 'json' ? parseJsonFieldValue(text).value : text);
  }
  return payload;
}
