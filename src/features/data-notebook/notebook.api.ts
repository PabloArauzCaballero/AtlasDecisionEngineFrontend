import { z } from 'zod';
import { apiRequest } from '../../api/http-client';

/**
 * Cliente del cuaderno de datos.
 *
 * Todo cuelga de `/atlas-backend/*`, que es el proxy del portal hacia AtlasBackend. No es `/v1/*`
 * a propósito: ese prefijo es del motor de decisión y el gate de superficie lo interpreta como tal.
 */
const BASE = '/atlas-backend/data-notebook';

export const notebookColumnSchema = z.object({
  name: z.string(),
  dataType: z.string().nullish(),
  piiType: z.string().nullable(),
  policy: z.enum(['PLAIN', 'MASKED', 'REDACTED']),
  reason: z.string().nullable(),
});

export type NotebookColumn = z.infer<typeof notebookColumnSchema>;

export const notebookDatasetSchema = z.object({
  code: z.string(),
  view: z.string(),
  label: z.string(),
  description: z.string(),
});

export type NotebookDataset = z.infer<typeof notebookDatasetSchema>;

const notebookCatalogSchema = z.object({
  datasets: z.array(notebookDatasetSchema),
  limits: z.object({
    maxPageSize: z.number(),
    defaultPageSize: z.number(),
    maxDatasetRows: z.number(),
    countCeiling: z.number(),
    ratePerMinute: z.number(),
  }),
  reveal: z.boolean(),
});

export type NotebookCatalog = z.infer<typeof notebookCatalogSchema>;

const notebookPageSchema = z.object({
  dataset: z.object({ code: z.string(), label: z.string(), view: z.string() }),
  columns: z.array(notebookColumnSchema),
  rows: z.array(z.record(z.unknown())),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalIsExact: z.boolean(),
  masked: z.boolean(),
});

export type NotebookPage = z.infer<typeof notebookPageSchema>;

export function fetchNotebookCatalog(signal?: AbortSignal): Promise<NotebookCatalog> {
  return apiRequest(`${BASE}/datasets`, { signal, responseSchema: notebookCatalogSchema });
}

export interface NotebookPageQuery {
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export function fetchNotebookPage(
  code: string,
  query: NotebookPageQuery,
  signal?: AbortSignal,
): Promise<NotebookPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    orderDirection: query.orderDirection ?? 'DESC',
  });
  if (query.orderBy) params.set('orderBy', query.orderBy);

  return apiRequest(`${BASE}/datasets/${encodeURIComponent(code)}/rows?${params}`, {
    signal,
    responseSchema: notebookPageSchema,
  });
}
