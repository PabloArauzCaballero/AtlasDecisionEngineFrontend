import type { TableColumn } from '../components/DataTable';

export type ResourceRow = Record<string, unknown>;

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

/**
 * `json` es un valor tipado, no texto: el campo se envía como el JSON que el
 * analista escribe (`1500` → número, `{"min":0}` → objeto) y cae a cadena cuando
 * no es JSON válido. Hace falta porque partes del contrato de variable —los
 * ejemplos y las restricciones de §1.1— no son cadenas y mandarlas como tales
 * haría que el backend rechazara un ejemplo correcto por tipo.
 */
export type CreateFieldKind = 'text' | 'textarea' | 'select' | 'checkbox' | 'json';

export interface CreateFieldOption {
  value: string;
  label: string;
}

export interface CreateField {
  /** Dot-notation builds a nested payload, e.g. `initialVersion.dataType`. */
  key: string;
  label: string;
  kind?: CreateFieldKind;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly CreateFieldOption[];
  /**
   * Read-model endpoint that returns `{ value, label }[]` for a catalog-backed
   * select (enum-like or DB-sourced values). Degrades to a free input if the
   * endpoint is unavailable or empty. See /v1/views/options.
   */
  optionsEndpoint?: string;
  /** Uppercases and strips to [A-Z0-9_-] as the user types (stable resource codes). */
  code?: boolean;
  defaultValue?: string | boolean;
}

/**
 * Picker-backed filter: a real select whose options come from an entity picker
 * endpoint (e.g. `pickers/artifacts`) mapping arbitrary row keys to value/label.
 * Unlike `optionsEndpoint` (which needs `{ value, label }` rows), this adapts the
 * domain-shaped picker rows the rest of the app already uses.
 */
export interface FilterPicker {
  endpoint: string;
  /** Row key used as the option value (the query-param value). */
  valueKey: string;
  /** Row keys joined with · to build the option label. */
  labelKeys: readonly string[];
}

export interface ResourceFilter {
  /** Real backend query parameter this control sends (e.g. `status`). */
  param: string;
  label: string;
  /** With options → a select of allowed values; without → a free-text input. */
  options?: readonly CreateFieldOption[];
  /**
   * Read-model endpoint returning `{ value, label }[]` for a catalog-backed filter
   * (e.g. `/v1/views/options?group=reasonCategory`). Renders a real select whose
   * options come from the backend; degrades to a free-text input if unavailable.
   */
  optionsEndpoint?: string;
  /** Entity picker backing this filter (e.g. artefactos), mapping row keys. */
  picker?: FilterPicker;
  /** HTML input type for free-text filters (e.g. `date`, `number`). Defaults to text. */
  inputType?: string;
  placeholder?: string;
}

export interface ResourceConfig {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  /** Plain-language "what is this tool for" hint (shown as a ? beside the title). */
  hint?: string;
  endpoint: string;
  columns: readonly TableColumn<ResourceRow>[];
  filterParam?: string;
  filterLabel?: string;
  filterPlaceholder?: string;
  /** When set, the primary filter is a picker-backed select instead of free text. */
  filterPicker?: FilterPicker;
  unpaged?: boolean;
  primaryAction?: string;
  /** When present, the list view renders a built-in create form for this resource. */
  createFields?: readonly CreateField[];
  /** Constant payload defaults deep-merged under the create form values (e.g. required arrays). */
  createStaticBody?: Record<string, unknown>;
  detailPath?: (row: ResourceRow) => string;
  /** Extra filters wired to real backend query params, shown under "Más filtros". */
  filters?: readonly ResourceFilter[];
}
