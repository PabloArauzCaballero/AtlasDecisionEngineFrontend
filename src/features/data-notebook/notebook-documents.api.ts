import { z } from 'zod';
import { apiRequest } from '../../api/http-client';
import { BASE, sobre } from './notebook-transport';

/**
 * Los cuadernos guardados: leerlos, crearlos, actualizarlos y borrarlos.
 *
 * Separado del cliente de DATASETS (`notebook.api.ts`) porque son dos cosas
 * distintas y se tocan por motivos distintos: aquél descubre qué datos hay y los
 * sirve por páginas; esto guarda el trabajo de una persona.
 */

/**
 * Un cuaderno guardado: las celdas Y lo que cada una arrojó la última vez.
 *
 * El avance se guarda porque el avance ES el trabajo: un cuaderno que se reabre en blanco obliga a
 * reejecutarlo todo para volver a ver lo que ya se había visto. Lo que viaja dentro de `table` son
 * las filas ENMASCARADAS que sirvió `read_api`, nunca el dato en claro.
 *
 * `savedAt` no es opcional y ésa es la pieza que hace honesto lo demás: al restaurar, cada
 * resultado sale rotulado con su fecha. Sin ella, un número de la semana pasada junto al dataset
 * de hoy se lee como si acabara de calcularse.
 */
export const storedOutcomeSchema = z.object({
  status: z.enum(['ok', 'error']),
  value: z.unknown().optional(),
  table: z
    .object({ columns: z.array(z.string()), rows: z.array(z.record(z.unknown())) })
    .optional(),
  images: z.array(z.string()).optional(),
  error: z.string().optional(),
  logs: z.array(z.string()),
  durationMs: z.number(),
  executionCount: z.number().nullable().optional(),
  savedAt: z.string(),
});

export type StoredOutcome = z.infer<typeof storedOutcomeSchema>;

export const storedCellSchema = z.object({
  kind: z.enum(['code', 'markdown']),
  language: z.enum(['python', 'javascript', 'r']),
  source: z.string(),
  outcome: storedOutcomeSchema.nullish(),
});

export type StoredCell = z.infer<typeof storedCellSchema>;

const notebookDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  datasetCode: z.string().nullable(),
  cells: z.array(storedCellSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type NotebookDocument = z.infer<typeof notebookDocumentSchema>;

const notebookSummarySchema = notebookDocumentSchema.omit({ cells: true }).extend({
  cellCount: z.number(),
});

export type NotebookSummary = z.infer<typeof notebookSummarySchema>;

export interface NotebookDocumentInput {
  title: string;
  datasetCode?: string | null;
  cells: StoredCell[];
}

export function fetchNotebooks(signal?: AbortSignal): Promise<NotebookSummary[]> {
  return apiRequest(`${BASE}/notebooks`, {
    signal,
    responseSchema: sobre(z.array(notebookSummarySchema)),
  });
}

export function fetchNotebook(id: string, signal?: AbortSignal): Promise<NotebookDocument> {
  return apiRequest(`${BASE}/notebooks/${encodeURIComponent(id)}`, {
    signal,
    responseSchema: sobre(notebookDocumentSchema),
  });
}

export function createNotebook(body: NotebookDocumentInput): Promise<NotebookDocument> {
  return apiRequest(`${BASE}/notebooks`, {
    method: 'POST',
    body,
    responseSchema: sobre(notebookDocumentSchema),
  });
}

export function updateNotebook(id: string, body: NotebookDocumentInput): Promise<NotebookDocument> {
  return apiRequest(`${BASE}/notebooks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
    responseSchema: sobre(notebookDocumentSchema),
  });
}

export function deleteNotebook(id: string): Promise<{ deleted: boolean }> {
  return apiRequest(`${BASE}/notebooks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    responseSchema: sobre(z.object({ deleted: z.boolean() })),
  });
}
