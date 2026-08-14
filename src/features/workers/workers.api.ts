import { apiDownload, type DownloadedFile } from '../../api/file-download';
import { apiRequest } from '../../api/http-client';
import type { AudioTemplate } from './audio-types';
import type { WorkerDescriptor, WorkerFixture, WorkerMetrics, WorkerRun } from './worker-types';

/**
 * Llamadas a los workers adicionales.
 *
 * Todo pasa por `apiRequest`, que es la única puerta HTTP del portal: añade la
 * sesión, rota el token al recibir un 401 y normaliza los errores. Un `fetch`
 * directo aquí se saltaría las tres cosas.
 */

export type WorkerCode =
  'semantic-analysis' | 'bank-statement' | 'identity-verification' | 'audio-tts';

/**
 * El motor devuelve un **array desnudo** en las respuestas de colección, no un
 * sobre `{ items }`: ésa es la convención de `ApiArrayResponse`, la misma que
 * usan despliegues y árboles anidados. El sobre sólo aparece en las respuestas
 * paginadas.
 *
 * Se normaliza aquí, en un solo sitio, en vez de en cada vista: dar por hecho el
 * sobre hacía que el catálogo llegara `undefined` y las dos pantallas dijeran
 * «no se pudo consultar el catálogo» contra un motor que respondía 200.
 */
function toItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const envelope = payload as { items?: unknown } | null;
  return Array.isArray(envelope?.items) ? (envelope.items as T[]) : [];
}

export async function fetchWorkerCatalog(signal?: AbortSignal): Promise<WorkerDescriptor[]> {
  return toItems<WorkerDescriptor>(await apiRequest<unknown>('/v1/workers', { signal }));
}

export async function fetchFixtures(
  worker: WorkerCode,
  signal?: AbortSignal,
): Promise<WorkerFixture[]> {
  return toItems<WorkerFixture>(
    await apiRequest<unknown>(`/v1/workers/${worker}/fixtures`, { signal }),
  );
}

export function fetchRun(
  worker: WorkerCode,
  requestId: string,
  signal?: AbortSignal,
): Promise<WorkerRun> {
  return apiRequest<WorkerRun>(`/v1/workers/${worker}/runs/${requestId}`, { signal });
}

/**
 * Salud del worker: reparto por estado, latencia, cola e incidencias.
 *
 * Lo calcula el motor sobre la ventana completa (`percentile_cont` en la base),
 * no esta pantalla sobre una página de ejecuciones. La diferencia no es de
 * estilo: derivándolo aquí, el percentil describía **las filas que cupieron en
 * la página** y cambiaba con el tamaño de página, y cualquier segunda vista
 * tendría que repetir la misma aritmética con el riesgo de dar otra cifra del
 * mismo worker.
 */
export function fetchWorkerMetrics(
  worker: WorkerCode,
  windowHours: number,
  signal?: AbortSignal,
): Promise<WorkerMetrics> {
  return apiRequest<WorkerMetrics>(`/v1/workers/${worker}/metrics?windowHours=${windowHours}`, {
    signal,
  });
}

/**
 * Ejecuciones del tenant, de la más reciente a la más antigua.
 *
 * Ésta sí es una respuesta **paginada** (`{ items, total, … }`), a diferencia
 * del catálogo y de los escenarios: el sobre se conserva porque el total dice
 * cuántas ejecuciones hay en el motor, no cuántas cupieron en la página.
 *
 * El panel ya NO se deriva de aquí: eso lo publica `fetchWorkerMetrics`. Lo que
 * esta llamada sigue alimentando es el gráfico de barras, que necesita la
 * duración de cada ejecución por separado —un percentil no se puede desagregar
 * en las muestras que lo produjeron—.
 */
export async function fetchRuns(
  worker: WorkerCode,
  options: { pageSize?: number; status?: string; signal?: AbortSignal } = {},
): Promise<{ items: WorkerRun[]; total: number }> {
  const query = new URLSearchParams({ page: '1', pageSize: String(options.pageSize ?? 50) });
  if (options.status) query.set('status', options.status);

  const payload = await apiRequest<unknown>(`/v1/workers/${worker}/runs?${query}`, {
    signal: options.signal,
  });
  const envelope = payload as { items?: unknown; total?: unknown } | null;
  const items = toItems<WorkerRun>(Array.isArray(payload) ? payload : envelope?.items);
  return { items, total: typeof envelope?.total === 'number' ? envelope.total : items.length };
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
  /**
   * Fuerza un análisis nuevo de un texto ya analizado.
   *
   * Sin ella el motor deriva la clave del CONTENIDO, así que reenviar la misma
   * glosa devuelve la ejecución vieja tal cual —incluida su categoría—, aunque
   * el catálogo de categorías haya cambiado desde entonces. Pasarla es la vía
   * que el motor documenta para volver a preguntar.
   */
  idempotencyKey?: string;
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

/**
 * Encola una verificación de identidad.
 *
 * Va como `multipart/form-data` porque lleva hasta tres imágenes, y **no se
 * fija `Content-Type` a mano** por lo mismo que en el extracto: el navegador
 * tiene que añadir el `boundary` que separa las partes.
 *
 * `documentCountry` decide qué analizador de documento usa el motor, así que no
 * es un adorno: mandar una cédula boliviana declarando otro país la analiza con
 * el analizador genérico y la deja sin campos.
 */
export function createIdentityVerificationRun(input: {
  document?: File;
  documentBack?: File;
  selfie?: File;
  fixtureCode?: string;
  documentCountry?: string;
  /** Fuerza una verificación nueva de las mismas imágenes. Ver el semántico. */
  idempotencyKey?: string;
}): Promise<WorkerRun> {
  const form = new FormData();
  if (input.document) form.append('document', input.document, input.document.name);
  if (input.documentBack) form.append('documentBack', input.documentBack, input.documentBack.name);
  if (input.selfie) form.append('selfie', input.selfie, input.selfie.name);
  if (input.fixtureCode) form.append('fixtureCode', input.fixtureCode);
  if (input.documentCountry) form.append('documentCountry', input.documentCountry);
  if (input.idempotencyKey) form.append('idempotencyKey', input.idempotencyKey);

  return apiRequest<WorkerRun>('/v1/workers/identity-verification/runs', {
    method: 'POST',
    body: form,
  });
}

/** Las plantillas que este tenant puede locutar, con sus variables. */
export async function fetchAudioTemplates(signal?: AbortSignal): Promise<AudioTemplate[]> {
  return toItems<AudioTemplate>(
    await apiRequest<unknown>('/v1/workers/audio-tts/templates', { signal }),
  );
}

/**
 * Encola una locución.
 *
 * Va como JSON y no como `multipart`: aquí no sube nada: lo que viaja es qué
 * plantilla decir y con qué valores. **No hay campo de texto libre**, y no es
 * una carencia de esta pantalla: lo que se puede decir con la voz de una
 * organización lo fija su catálogo. Un cuadro de texto abierto convertiría a
 * cualquiera con permiso en alguien capaz de poner cualquier frase en boca de
 * la marca —y de gastar el presupuesto del mes escribiendo—.
 */
export function createAudioTtsRun(body: {
  templateCode?: string;
  variables?: Record<string, string>;
  language?: string;
  fixtureCode?: string;
  /** Fuerza una locución nueva de lo mismo. Ver el semántico. */
  idempotencyKey?: string;
}): Promise<WorkerRun> {
  return apiRequest<WorkerRun>('/v1/workers/audio-tts/runs', { method: 'POST', body });
}

/**
 * Trae el audio ya generado, por la puerta autenticada.
 *
 * No se apunta un `<audio src="/v1/…">` directamente: cargar un medio es una
 * petición del navegador y ahí no viaja el `Authorization` —el portal no tiene
 * sesión por cookie—, así que el reproductor recibiría un 401 y se quedaría
 * mudo sin decir por qué. Pidiéndolo aquí la credencial va puesta y lo que se
 * reproduce es un blob local.
 */
export function downloadAudio(requestId: string): Promise<DownloadedFile> {
  return apiDownload(`/v1/workers/audio-tts/runs/${requestId}/audio`, `locucion-${requestId}.mp3`);
}

export type StatementFormat = 'csv' | 'json' | 'normalized';

/**
 * Pide el resultado ya serializado y lo devuelve como archivo en memoria.
 *
 * Antes eran enlaces `<a href download>` y no funcionaban: seguir un enlace es
 * una navegación del navegador, ahí no viaja el `Authorization` —el portal no
 * tiene sesión por cookie— y el motor respondía 401. Lo que se descargaba era el
 * error, con nombre `download.json`. Pidiéndolo por la puerta autenticada la
 * credencial va puesta y el 403 de quien no tiene permiso sigue decidiéndose en
 * el servidor, no escondiendo el botón.
 */
export function downloadStatement(
  requestId: string,
  format: StatementFormat,
): Promise<DownloadedFile> {
  const extension = format === 'csv' ? 'csv' : 'json';
  return apiDownload(
    `/v1/workers/bank-statement/runs/${requestId}/download?format=${format}`,
    `extracto-${format}.${extension}`,
  );
}
