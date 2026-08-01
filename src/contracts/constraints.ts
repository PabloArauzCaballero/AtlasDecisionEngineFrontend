/**
 * Restricciones configurables desde el editor (§1.2).
 *
 * IMPORTANTE: esta validación es SOLO para feedback inmediato mientras se escribe. La
 * validación autoritativa vive en el backend y se ejecuta siempre, aunque aquí todo
 * parezca correcto. Si estas reglas se separan de las del motor, el usuario verá un
 * aviso que no coincide con el rechazo real — molesto, pero nunca inseguro.
 */
import { normalizeDataType, NUMERIC_TYPES, type DataType } from './data-types';

export interface VariableConstraints {
  min?: number;
  max?: number;
  exclusiveMin?: number;
  exclusiveMax?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  precision?: number;
  scale?: number;
  pattern?: string;
  allowedValues?: unknown[];
  format?: string;
  unique?: boolean;
  itemType?: DataType;
}

export const CONSTRAINT_FORMATS = [
  'EMAIL',
  'UUID',
  'ISO_COUNTRY',
  'ISO_CURRENCY',
  'URL',
  'PHONE',
  'IBAN',
] as const;

const FORMAT_PATTERNS: Readonly<Record<string, RegExp>> = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  UUID: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  ISO_COUNTRY: /^[A-Z]{2}$/,
  ISO_CURRENCY: /^[A-Z]{3}$/,
  URL: /^https?:\/\/[^\s]+$/,
  PHONE: /^\+?[0-9][0-9\s-]{5,19}$/,
  IBAN: /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;

export function parseConstraints(raw: unknown): VariableConstraints {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const numeric = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return undefined;
  };
  const constraints: VariableConstraints = {
    min: numeric('min', 'minimum'),
    max: numeric('max', 'maximum'),
    exclusiveMin: numeric('exclusiveMin', 'exclusiveMinimum'),
    exclusiveMax: numeric('exclusiveMax', 'exclusiveMaximum'),
    minLength: numeric('minLength'),
    maxLength: numeric('maxLength'),
    minItems: numeric('minItems'),
    maxItems: numeric('maxItems'),
    precision: numeric('precision'),
    scale: numeric('scale'),
    pattern: typeof source.pattern === 'string' ? source.pattern : undefined,
    allowedValues: Array.isArray(source.allowedValues)
      ? source.allowedValues
      : Array.isArray(source.enum)
        ? source.enum
        : undefined,
    format: typeof source.format === 'string' ? source.format.toUpperCase() : undefined,
    unique: typeof source.unique === 'boolean' ? source.unique : undefined,
    itemType: typeof source.itemType === 'string' ? normalizeDataType(source.itemType) : undefined,
  };
  return Object.fromEntries(
    Object.entries(constraints).filter(([, value]) => value !== undefined),
  ) as VariableConstraints;
}

/** Descripción legible de una restricción, para el chip que la resume en la UI. */
export function describeConstraints(constraints: VariableConstraints): string[] {
  const parts: string[] = [];
  if (constraints.min !== undefined) parts.push(`mín ${constraints.min}`);
  if (constraints.exclusiveMin !== undefined) parts.push(`> ${constraints.exclusiveMin}`);
  if (constraints.max !== undefined) parts.push(`máx ${constraints.max}`);
  if (constraints.exclusiveMax !== undefined) parts.push(`< ${constraints.exclusiveMax}`);
  if (constraints.minLength !== undefined) parts.push(`≥ ${constraints.minLength} caracteres`);
  if (constraints.maxLength !== undefined) parts.push(`≤ ${constraints.maxLength} caracteres`);
  if (constraints.minItems !== undefined) parts.push(`≥ ${constraints.minItems} elementos`);
  if (constraints.maxItems !== undefined) parts.push(`≤ ${constraints.maxItems} elementos`);
  if (constraints.scale !== undefined) parts.push(`${constraints.scale} decimales`);
  if (constraints.precision !== undefined) parts.push(`${constraints.precision} dígitos`);
  if (constraints.pattern) parts.push('patrón');
  if (constraints.format) parts.push(constraints.format.toLowerCase());
  if (constraints.unique) parts.push('sin duplicados');
  if (constraints.allowedValues?.length) {
    parts.push(`${constraints.allowedValues.length} valores permitidos`);
  }
  return parts;
}

/** Comprobación local del valor de ejemplo. Devuelve los motivos de rechazo. */
export function previewValidate(
  dataType: unknown,
  constraints: VariableConstraints,
  value: unknown,
): string[] {
  const type = normalizeDataType(dataType);
  const shape = checkShape(type, value);
  if (shape) return [shape];

  const errors: string[] = [];
  if (typeof value === 'number') {
    if (constraints.min !== undefined && value < constraints.min) {
      errors.push(`debe ser al menos ${constraints.min}`);
    }
    if (constraints.max !== undefined && value > constraints.max) {
      errors.push(`no puede superar ${constraints.max}`);
    }
    if (constraints.exclusiveMin !== undefined && value <= constraints.exclusiveMin) {
      errors.push(`debe ser mayor que ${constraints.exclusiveMin}`);
    }
    if (constraints.exclusiveMax !== undefined && value >= constraints.exclusiveMax) {
      errors.push(`debe ser menor que ${constraints.exclusiveMax}`);
    }
    if (constraints.scale !== undefined && decimalsOf(value) > constraints.scale) {
      errors.push(`admite ${constraints.scale} decimales como máximo`);
    }
  }
  if (typeof value === 'string') {
    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
      errors.push(`debe tener al menos ${constraints.minLength} caracteres`);
    }
    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
      errors.push(`no puede superar ${constraints.maxLength} caracteres`);
    }
    if (constraints.pattern && !safeTest(constraints.pattern, value)) {
      errors.push('no cumple el patrón exigido');
    }
    const formatPattern = constraints.format ? FORMAT_PATTERNS[constraints.format] : undefined;
    if (formatPattern && !formatPattern.test(value)) {
      errors.push(`no tiene formato ${constraints.format?.toLowerCase()}`);
    }
  }
  if (Array.isArray(value)) {
    if (constraints.minItems !== undefined && value.length < constraints.minItems) {
      errors.push(`debe tener al menos ${constraints.minItems} elementos`);
    }
    if (constraints.maxItems !== undefined && value.length > constraints.maxItems) {
      errors.push(`no puede superar ${constraints.maxItems} elementos`);
    }
    if (
      constraints.unique &&
      new Set(value.map((item) => JSON.stringify(item))).size !== value.length
    ) {
      errors.push('los elementos deben ser distintos');
    }
  }
  if (
    constraints.allowedValues?.length &&
    !constraints.allowedValues.some((candidate) => candidate === value)
  ) {
    errors.push('no está entre los valores permitidos');
  }
  return errors;
}

function checkShape(type: DataType, value: unknown): string | null {
  if (NUMERIC_TYPES.has(type)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'se esperaba un número';
    if (type === 'INTEGER' && !Number.isInteger(value)) return 'se esperaba un número entero';
    if (type === 'PERCENTAGE' && (value < 0 || value > 100)) {
      return 'un porcentaje debe estar entre 0 y 100';
    }
    return null;
  }
  if (type === 'BOOLEAN') return typeof value === 'boolean' ? null : 'se esperaba sí o no';
  if (type === 'LIST') return Array.isArray(value) ? null : 'se esperaba una lista';
  if (type === 'OBJECT' || type === 'STRUCTURED_RESULT') {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? null
      : 'se esperaba un objeto';
  }
  if (typeof value !== 'string') return 'se esperaba texto';
  if (type === 'DATE' && !ISO_DATE.test(value)) return 'se esperaba una fecha AAAA-MM-DD';
  if (type === 'TIME' && !ISO_TIME.test(value)) return 'se esperaba una hora HH:MM';
  if (type === 'DATETIME' && Number.isNaN(Date.parse(value))) {
    return 'se esperaba una fecha y hora ISO';
  }
  return null;
}

/**
 * Un patrón lo escribe el autor, así que puede ser catastróficamente lento. Se acota la
 * longitud y se compila dentro de un try: un editor no puede colgarse por un regex.
 */
function safeTest(pattern: string, value: string): boolean {
  if (pattern.length > 200 || value.length > 2_000) return true;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
}

function decimalsOf(value: number): number {
  const text = String(value);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}
