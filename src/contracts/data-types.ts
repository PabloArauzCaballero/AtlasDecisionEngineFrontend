/**
 * Espejo del catálogo canónico de tipos del backend (§1.1).
 *
 * El frontend necesita esta lista para pintar selectores y dar feedback inmediato,
 * pero NO es la fuente autoritativa: el backend revalida siempre. Si las dos listas se
 * separan, `contracts.test.ts` lo detecta comparando contra el contrato publicado.
 */
export const DATA_TYPES = [
  'STRING',
  'LONG_TEXT',
  'INTEGER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'TIME',
  'ENUM',
  'LIST',
  'OBJECT',
  'IDENTIFIER',
  'PERCENTAGE',
  'CURRENCY',
  'CODE',
  'STRUCTURED_RESULT',
] as const;

export type DataType = (typeof DATA_TYPES)[number];

/** Etiquetas en el idioma del producto: el autor no piensa en «STRUCTURED_RESULT». */
export const DATA_TYPE_LABELS: Readonly<Record<DataType, string>> = {
  STRING: 'Texto',
  LONG_TEXT: 'Texto largo',
  INTEGER: 'Número entero',
  DECIMAL: 'Número decimal',
  BOOLEAN: 'Sí / No',
  DATE: 'Fecha',
  DATETIME: 'Fecha y hora',
  TIME: 'Hora',
  ENUM: 'Lista de valores permitidos',
  LIST: 'Lista',
  OBJECT: 'Objeto',
  IDENTIFIER: 'Identificador',
  PERCENTAGE: 'Porcentaje',
  CURRENCY: 'Importe',
  CODE: 'Código',
  STRUCTURED_RESULT: 'Resultado estructurado',
};

const ALIASES: Readonly<Record<string, DataType>> = {
  TEXT: 'STRING',
  VARCHAR: 'STRING',
  UUID: 'IDENTIFIER',
  ID: 'IDENTIFIER',
  INT: 'INTEGER',
  BIGINT: 'INTEGER',
  NUMBER: 'DECIMAL',
  FLOAT: 'DECIMAL',
  DOUBLE: 'DECIMAL',
  NUMERIC: 'DECIMAL',
  MONEY: 'CURRENCY',
  BOOL: 'BOOLEAN',
  ARRAY: 'LIST',
  JSON: 'OBJECT',
  MAP: 'OBJECT',
  TIMESTAMP: 'DATETIME',
  RESULT: 'STRUCTURED_RESULT',
};

export const NUMERIC_TYPES: ReadonlySet<DataType> = new Set<DataType>([
  'INTEGER',
  'DECIMAL',
  'PERCENTAGE',
  'CURRENCY',
]);

export const TEXTUAL_TYPES: ReadonlySet<DataType> = new Set<DataType>([
  'STRING',
  'LONG_TEXT',
  'ENUM',
  'IDENTIFIER',
  'CODE',
  'DATE',
  'DATETIME',
  'TIME',
]);

export function normalizeDataType(raw: unknown): DataType {
  const upper = String(raw ?? '')
    .trim()
    .toUpperCase();
  if ((DATA_TYPES as readonly string[]).includes(upper)) return upper as DataType;
  return ALIASES[upper] ?? 'STRING';
}

export function dataTypeLabel(raw: unknown): string {
  return DATA_TYPE_LABELS[normalizeDataType(raw)];
}

/** Clasificación de sensibilidad (§1.1 / §3.2), de menos a más restrictiva. */
export const SENSITIVITY_CLASSES = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'PII',
  'SENSITIVE_PII',
  'SECRET',
] as const;

export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

export const SENSITIVITY_LABELS: Readonly<Record<SensitivityClass, string>> = {
  PUBLIC: 'Público',
  INTERNAL: 'Interno',
  CONFIDENTIAL: 'Confidencial',
  PII: 'Dato personal',
  SENSITIVE_PII: 'Dato personal sensible',
  SECRET: 'Secreto',
};

/**
 * De dónde tiene que llegar el valor (`expectedOrigin`). Un código desconocido se
 * devuelve tal cual: la base tiene orígenes sembrados fuera de esta lista
 * (`ATLAS_BACKEND`) y traducirlos a «—» escondería de dónde sale el dato.
 */
export const VARIABLE_ORIGIN_LABELS: Readonly<Record<string, string>> = {
  REQUEST: 'Lo aporta quien pide la decisión',
  PROVIDER: 'Lo trae un proveedor externo',
  DERIVED: 'Lo calcula el motor durante la ejecución',
  CALCULATED_FIELD: 'Lo produce un campo calculado',
  GRAPH_NODE: 'Lo produce un nodo del grafo',
};

export function variableOriginLabel(raw: unknown): string {
  const code = String(raw ?? '').trim();
  if (!code) return '—';
  return VARIABLE_ORIGIN_LABELS[code.toUpperCase()] ?? code;
}

/** Política de inclusión en la traza (§2.2). */
export const TRACE_POLICIES = ['FULL', 'MASKED', 'REDACTED', 'EXCLUDED'] as const;
export type TracePolicy = (typeof TRACE_POLICIES)[number];

export const TRACE_POLICY_LABELS: Readonly<Record<TracePolicy, string>> = {
  FULL: 'Valor completo en la traza',
  MASKED: 'Enmascarado en la traza',
  REDACTED: 'Redactado (solo metadatos)',
  EXCLUDED: 'Excluido de la traza',
};
