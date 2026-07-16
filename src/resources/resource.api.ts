import { apiRequest } from '../api/http-client';
import type { PagedResponse, ResourceConfig, ResourceRow } from './resource.types';

export interface ResourceQuery {
  page: number;
  filter: string;
}

export async function listResource(
  config: ResourceConfig,
  query: ResourceQuery,
  signal?: AbortSignal,
): Promise<PagedResponse<ResourceRow>> {
  const params = new URLSearchParams();
  if (!config.unpaged) {
    params.set('page', String(query.page));
    params.set('pageSize', '25');
  }
  if (config.filterParam && query.filter.trim()) {
    params.set(config.filterParam, query.filter.trim());
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
