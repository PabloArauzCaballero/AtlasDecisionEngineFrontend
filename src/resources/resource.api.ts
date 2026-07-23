import { apiRequest } from '../api/http-client';
import type { PagedResponse, ResourceConfig, ResourceRow } from './resource.types';

export interface ResourceQuery {
  page: number;
  filter: string;
  /** Extra filter values keyed by their backend query param. */
  filters?: Record<string, string>;
  /** Overrides the page size (defaults to 25); used by exports to pull more rows. */
  pageSize?: number;
}

export async function listResource(
  config: ResourceConfig,
  query: ResourceQuery,
  signal?: AbortSignal,
): Promise<PagedResponse<ResourceRow>> {
  const params = new URLSearchParams();
  if (!config.unpaged) {
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize ?? 25));
  }
  if (config.filterParam && query.filter.trim()) {
    params.set(config.filterParam, query.filter.trim());
  }
  for (const [param, value] of Object.entries(query.filters ?? {})) {
    if (value.trim()) params.set(param, value.trim());
  }

  const suffix = params.size ? `?${params.toString()}` : '';
  const response = await apiRequest<PagedResponse<ResourceRow> | ResourceRow[]>(
    `${config.endpoint}${suffix}`,
    { signal },
  );

  if (Array.isArray(response)) {
    return {
      items: response,
      page: 1,
      pageSize: response.length,
      total: response.length,
      totalPages: 1,
      hasNextPage: false,
    };
  }

  return response;
}

const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_ROWS = 2000;

export interface ExportResult {
  rows: ResourceRow[];
  /** True when the backend had more rows than the export cap. */
  truncated: boolean;
}

/**
 * Pulls every row matching the active filters for a CSV export, paging through
 * the backend in bulk-sized pages up to a safety cap so a huge dataset can't
 * exhaust the browser. Unpaged resources return their single response as-is.
 */
export async function exportResource(
  config: ResourceConfig,
  query: Omit<ResourceQuery, 'page' | 'pageSize'>,
  signal?: AbortSignal,
): Promise<ExportResult> {
  if (config.unpaged) {
    const response = await listResource(config, { ...query, page: 1 }, signal);
    return { rows: response.items, truncated: false };
  }

  const rows: ResourceRow[] = [];
  let page = 1;
  for (;;) {
    const response = await listResource(
      config,
      { ...query, page, pageSize: EXPORT_PAGE_SIZE },
      signal,
    );
    rows.push(...response.items);
    if (!response.hasNextPage || rows.length >= EXPORT_MAX_ROWS) {
      return { rows: rows.slice(0, EXPORT_MAX_ROWS), truncated: rows.length > EXPORT_MAX_ROWS };
    }
    page += 1;
  }
}
