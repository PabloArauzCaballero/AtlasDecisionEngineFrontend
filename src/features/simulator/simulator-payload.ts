import { asRecord, display, type UnknownRecord } from '../../utils/records';

/**
 * Construye el payload de una simulación a partir del CONTRATO del artefacto.
 *
 * El simulador arrancaba con un ejemplo fijo (`requestedAmount`, `monthlyIncome`…)
 * que no tenía nada que ver con las variables que declara el artefacto elegido,
 * así que cualquier simulación devolvía NO_DECISION ·
 * VARIABLE_MISSING_OR_INVALID. Ahora el formulario se siembra con las variables
 * que el artefacto pide de verdad, conservando los valores que la persona ya
 * había escrito para esas mismas variables.
 */

const NUMERIC = new Set(['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'FLOAT']);

/** Valor inicial razonable para una variable: su valor por defecto, el primer
 *  valor admitido si es un enum, o un valor neutro válido para su tipo. */
export function seedValue(variable: UnknownRecord): unknown {
  if (variable.defaultValue !== undefined && variable.defaultValue !== null) {
    return variable.defaultValue;
  }
  const schema = asRecord(variable.validationSchema);
  const allowed = Array.isArray(schema.enum) ? schema.enum : [];
  if (allowed.length) return allowed[0];

  const dataType = display(variable, 'dataType').toUpperCase();
  if (dataType === 'BOOLEAN' || dataType === 'BOOL') return false;
  if (NUMERIC.has(dataType)) {
    if (typeof schema.minimum === 'number') return schema.minimum;
    // `exclusiveMinimum: 0` (importes, ingresos) descarta el cero: el mínimo
    // válido más simple es el siguiente entero.
    if (typeof schema.exclusiveMinimum === 'number') return schema.exclusiveMinimum + 1;
    return 0;
  }
  return '';
}

/**
 * Payload sembrado con las variables del contrato. Se respeta lo ya escrito para
 * una variable que el contrato también declara; el resto se descarta, porque
 * pertenecía a otro artefacto y sólo produce errores de validación.
 */
export function seedPayload(
  inputs: UnknownRecord[],
  current: Record<string, unknown> | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const variable of inputs) {
    const code = display(variable, 'variableCode', 'code');
    if (code === '—') continue;
    const existing = current?.[code];
    payload[code] = existing === undefined ? seedValue(variable) : existing;
  }
  return payload;
}

/** Variables obligatorias que siguen sin valor: lo que impediría decidir. */
export function missingRequired(
  inputs: UnknownRecord[],
  payload: Record<string, unknown> | null,
): string[] {
  return inputs
    .filter((variable) => Boolean(variable.isRequired ?? variable.required))
    .map((variable) => display(variable, 'variableCode', 'code'))
    .filter((code) => {
      const value = payload?.[code];
      return value === undefined || value === null || value === '';
    });
}
