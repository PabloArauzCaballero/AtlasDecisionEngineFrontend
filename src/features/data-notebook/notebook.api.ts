import { z } from 'zod';
import { apiRequest } from '../../api/http-client';
import { BASE, sobre } from './notebook-transport';

/**
 * Cliente de DATOS del cuaderno: catálogo de datasets, páginas e historial.
 *
 * Los cuadernos guardados viven en `notebook-documents.api.ts`; la raíz y el
 * sobre de AtlasBackend, en `notebook-transport.ts`.
 */
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

/**
 * Una vista de `read_api` que existe y el cuaderno NO sirve, con el motivo.
 *
 * AtlasBackend descubre su catálogo contra `information_schema` y lleva desde entonces mandando
 * esto; el portal lo tiraba, porque el esquema no lo declaraba y Zod descarta lo que no describe.
 * El resultado era el peor de los dos mundos: el backend se tomaba el trabajo de explicar por qué
 * había descartado una vista y la explicación no llegaba a ninguna pantalla, así que una vista mal
 * publicada se leía exactamente igual que una que no existe.
 *
 * Opcional porque el portal puede desplegarse contra una API anterior: sin el campo se enseña la
 * lista vacía, que es la verdad disponible, y no un error.
 */
export const omittedDatasetSchema = z.object({ view: z.string(), reason: z.string() });

export type OmittedDataset = z.infer<typeof omittedDatasetSchema>;

const notebookCatalogSchema = z.object({
  datasets: z.array(notebookDatasetSchema),
  omitted: z.array(omittedDatasetSchema).default([]),
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

/**
 * Se exporta el esquema CON su sobre, que es lo que de verdad se aplica a la respuesta.
 *
 * Es lo único que una prueba puede ejercitar de verdad: `apiRequest` es quien valida, así que una
 * prueba que lo mockee comprueba su propio mock y da verde pase lo que pase con el esquema. Es
 * exactamente cómo el sobre `{ data }` sobrevivió a veintiuna pruebas.
 */
export const notebookCatalogResponseSchema = sobre(notebookCatalogSchema);

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
  language: 'python' | 'javascript' | 'r';
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
    responseSchema: sobre(z.object({ id: z.string() })),
  });
}

const notebookHistoryPageSchema = z.object({
  rows: z.array(notebookHistoryRowSchema),
  /** Cuántas entradas hay en total, no cuántas trae esta página: es lo que permite paginar. */
  total: z.number(),
});

export type NotebookHistoryPage = z.infer<typeof notebookHistoryPageSchema>;

export function fetchNotebookHistory(
  query: { limit: number; offset: number },
  signal?: AbortSignal,
): Promise<NotebookHistoryPage> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  });
  return apiRequest(`${BASE}/history?${params}`, {
    signal,
    responseSchema: sobre(notebookHistoryPageSchema),
  });
}

export function fetchNotebookCatalog(signal?: AbortSignal): Promise<NotebookCatalog> {
  return apiRequest(`${BASE}/datasets`, { signal, responseSchema: sobre(notebookCatalogSchema) });
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
    responseSchema: sobre(notebookPageSchema),
  });
}
