import { apiRequest } from '../../api/http-client';
import type { WorkerDescriptor, WorkerFixture, WorkerRun } from './worker-types';

/**
 * Llamadas a los workers adicionales.
 *
 * Todo pasa por `apiRequest`, que es la única puerta HTTP del portal: añade la
 * sesión, rota el token al recibir un 401 y normaliza los errores. Un `fetch`
 * directo aquí se saltaría las tres cosas.
 */

export type WorkerCode = 'semantic-analysis' | 'bank-statement';

export function fetchWorkerCatalog(signal?: AbortSignal): Promise<{ items: WorkerDescriptor[] }> {
  return apiRequest<{ items: WorkerDescriptor[] }>('/v1/workers', { signal });
}

export function fetchFixtures(
  worker: WorkerCode,
  signal?: AbortSignal,
): Promise<{ items: WorkerFixture[] }> {
  return apiRequest<{ items: WorkerFixture[] }>(`/v1/workers/${worker}/fixtures`, { signal });
}

export function fetchRun(
  worker: WorkerCode,
  requestId: string,
  signal?: AbortSignal,
): Promise<WorkerRun> {
  return apiRequest<WorkerRun>(`/v1/workers/${worker}/runs/${requestId}`, { signal });
}

export function cancelRun(worker: WorkerCode, requestId: string): Promise<WorkerRun> {
  return apiRequest<WorkerRun>(`/v1/workers/${worker}/runs/${requestId}/cancel`, {
    method: 'POST',
  });
}

/** Encola un análisis semántico, con texto propio o con un escenario. */
export function createSemanticRun(body: {
  text?: string;
  fixtureCode?: string;
}): Promise<WorkerRun> {
  return apiRequest<WorkerRun>('/v1/workers/semantic-analysis/runs', {
    method: 'POST',
    body,
  });
}

/**
 * Encola una conversión de extracto.
 *
 * Va como `multipart/form-data` porque lleva un archivo. **No se fija
 * `Content-Type` a mano**: el navegador tiene que añadir el `boundary` que
 * separa las partes, y escribir la cabecera nosotros lo dejaría fuera y el
 * servidor no podría leer el cuerpo.
 */
export function createBankStatementRun(input: {
  file?: File;
  fixtureCode?: string;
}): Promise<WorkerRun> {
  const form = new FormData();
  if (input.file) form.append('file', input.file, input.file.name);
  if (input.fixtureCode) form.append('fixtureCode', input.fixtureCode);

  return apiRequest<WorkerRun>('/v1/workers/bank-statement/runs', {
    method: 'POST',
    body: form,
  });
}

export type StatementFormat = 'csv' | 'json' | 'normalized';

/** Ruta de descarga del resultado. La navegación la hace el navegador. */
export function statementDownloadPath(requestId: string, format: StatementFormat): string {
  return `/v1/workers/bank-statement/runs/${requestId}/download?format=${format}`;
}
