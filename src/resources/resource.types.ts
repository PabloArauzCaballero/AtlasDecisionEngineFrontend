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
  detailPath?: (row: ResourceRow) => string;
  staticFilters?: readonly string[];
}
