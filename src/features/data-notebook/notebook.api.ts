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
    // Con respaldo porque el portal puede desplegarse antes que la API que lo publica: sin él,
    // `undefined` acabaría escrito como «NaN MB» en el aviso de recorte.
    maxResponseBytes: z.number().default(8 * 1024 * 1024),
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
  // Opcionales para no romper contra un backend anterior al techo de bytes: un portal que se
  // despliega antes que su API no debe quedarse en blanco, sólo sin el aviso de truncado.
  bytes: z.number().optional(),
  droppedRows: z.number().optional(),
});

export type NotebookPage = z.infer<typeof notebookPageSchema>;

/**
 * Lo que se registra de una celda ejecutada. Fíjate en lo que NO viaja.
 *
 * No hay campo para las filas devueltas, y el backend además lo rechaza: guardar el resultado
 * convertiría el historial en una segunda copia de datos personales fuera de `read_api`, sin
 * enmascarado y sin caducidad. Lo que se guarda es el CÓDIGO, que es lo reproducible.
 */
export interface NotebookHistoryEntry {
  language: 'python' | 'javascript';
  source: string;
  datasetCode?: string;
  datasetPage?: number;
  rowCount?: number;
  durationMs?: number;
  status: 'ok' | 'error';
  errorMessage?: string;
}

const notebookHistoryRowSchema = z.object({
  id: z.string(),
  language: z.string(),
  source: z.string(),
  datasetCode: z.string().nullable(),
  datasetPage: z.number().nullable(),
  rowCount: z.number().nullable(),
  durationMs: z.number().nullable(),
  status: z.string(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});

export type NotebookHistoryRow = z.infer<typeof notebookHistoryRowSchema>;

export function recordNotebookHistory(entry: NotebookHistoryEntry): Promise<{ id: string }> {
  return apiRequest(`${BASE}/history`, {
    method: 'POST',
    body: entry,
    responseSchema: z.object({ id: z.string() }),
  });
}

export function fetchNotebookHistory(signal?: AbortSignal): Promise<NotebookHistoryRow[]> {
  return apiRequest(`${BASE}/history`, {
    signal,
    responseSchema: z.array(notebookHistoryRowSchema),
  });
}

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
