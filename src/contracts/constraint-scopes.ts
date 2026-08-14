/**
 * Restricciones que NO son un límite plano: las que dependen de otro campo o solo
 * aplican en un eje de despliegue (país, producto, ambiente, tenant, versión).
 *
 * Vive aparte de `constraints.ts` porque el motor las evalúa igual que a las demás
 * —`resolveConstraints()` las aplana sobre la base antes de validar— pero el portal
 * no las leía: `parseConstraints` las descartaba, así que una variable con un tramo
 * por país se mostraba como si solo tuviera el tramo general. Quien miraba la ficha
 * creía conocer el contrato entero y le faltaba justo la parte que cambia.
 */

export type ConditionalOperator =
  'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'GREATER_THAN' | 'LESS_THAN' | 'PRESENT' | 'ABSENT';

export interface ConditionalRule {
  /** Código de la variable observada. */
  whenField: string;
  operator: ConditionalOperator;
  value?: unknown;
  /** Restricciones que se AÑADEN cuando la condición se cumple. */
  constraints?: Record<string, unknown>;
  /** Con `true`, el campo pasa a ser obligatorio si la condición se cumple. */
  required?: boolean;
  message?: string;
}

export interface ScopedConstraint {
  /** Valores del eje en los que aplica; lista vacía = todos. */
  match?: string[];
  constraints?: Record<string, unknown>;
}

/** Los cinco ejes que el motor conoce, con el nombre del campo tal cual se guarda. */
export const SCOPE_AXES = [
  { key: 'byCountry', label: 'Según el país' },
  { key: 'byProduct', label: 'Según el producto' },
  { key: 'byEnvironment', label: 'Según el ambiente' },
  { key: 'byTenant', label: 'Según el tenant' },
  { key: 'byContractVersion', label: 'Según la versión del contrato' },
] as const;

export type ScopeAxis = (typeof SCOPE_AXES)[number]['key'];

const OPERATOR_TEXT: Readonly<Record<ConditionalOperator, string>> = {
  EQUALS: 'es igual a',
  NOT_EQUALS: 'es distinto de',
  IN: 'está entre',
  NOT_IN: 'no está entre',
  GREATER_THAN: 'es mayor que',
  LESS_THAN: 'es menor que',
  PRESENT: 'tiene valor',
  ABSENT: 'viene vacío',
};

export function parseConditional(raw: unknown): ConditionalRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rules = raw.filter(
    (item): item is ConditionalRule =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as ConditionalRule).whenField === 'string' &&
      OPERATOR_TEXT[(item as ConditionalRule).operator] !== undefined,
  );
  return rules.length ? rules : undefined;
}

export function parseScoped(raw: unknown): ScopedConstraint[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries = raw.filter(
    (item): item is ScopedConstraint => typeof item === 'object' && item !== null,
  );
  return entries.length ? entries : undefined;
}

/** «Si tipo_documento es igual a PASSPORT» — el disparador, sin la consecuencia. */
export function describeCondition(rule: ConditionalRule): string {
  const operator = OPERATOR_TEXT[rule.operator] ?? rule.operator;
  if (rule.operator === 'PRESENT' || rule.operator === 'ABSENT') {
    return `Si ${rule.whenField} ${operator}`;
  }
  return `Si ${rule.whenField} ${operator} ${formatScopeValue(rule.value)}`;
}

/** «En BO, PE» o «En cualquier valor del eje» cuando la lista viene vacía. */
export function describeScopeMatch(entry: ScopedConstraint): string {
  return entry.match?.length ? `En ${entry.match.join(', ')}` : 'En cualquier valor del eje';
}

export function formatScopeValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatScopeValue(item)).join(', ');
  if (value === null) return 'nulo';
  if (value === undefined) return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
