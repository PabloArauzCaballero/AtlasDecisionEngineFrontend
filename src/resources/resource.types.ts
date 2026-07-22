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

export type CreateFieldKind = 'text' | 'textarea' | 'select' | 'checkbox';

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

export interface ResourceConfig {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  endpoint: string;
  columns: readonly TableColumn<ResourceRow>[];
  filterParam?: string;
  filterLabel?: string;
  filterPlaceholder?: string;
  unpaged?: boolean;
  primaryAction?: string;
  /** When present, the list view renders a built-in create form for this resource. */
  createFields?: readonly CreateField[];
  /** Constant payload defaults deep-merged under the create form values (e.g. required arrays). */
  createStaticBody?: Record<string, unknown>;
  detailPath?: (row: ResourceRow) => string;
  staticFilters?: readonly string[];
}
