import { apiRequest } from '../../api/http-client';
import { apiDownload, type DownloadedFile } from '../../api/file-download';
import {
  artifactListSchema,
  artifactSampleSchema,
  compatibilityReportSchema,
  generatedDocumentSchema,
  pdfHealthSchema,
  templateListSchema,
  templateSchemaResultSchema,
  validationResultSchema,
  type GeneratedDocument,
  type PdfHealthReport,
  type TemplateSchemaResult,
  type TemplateSummary,
  type ValidationResult,
  type ArtifactSample,
  type BindableArtifact,
  type CompatibilityReport,
} from './document-types';

/**
 * Cliente del generador documental del motor.
 *
 * Vive fuera de `features/workers/` a propósito: el generador NO está en el
 * catálogo de workers del motor. Aquéllos comparten catálogo, métricas y mapa
 * de ejecuciones —por eso el panel de un worker sirve para los cuatro—; éste es
 * otro subsistema, con su propia salud y su propio ciclo de vida. Meterlo en
 * `workers.api.ts` haría creer que se le pueden pedir las mismas cosas.
 *
 * Las rutas se escriben ENTERAS y nunca interpolando el nombre de la operación:
 * es la misma regla que con `/v1/…` y por el mismo motivo —una interpolación se
 * lee como comodín y da por consumidas operaciones que nadie mira—.
 */

export interface GenerateDocumentRequest {
  templateId: string;
  templateVersion?: string;
  payload: unknown;
  filename?: string;
}

export function fetchPdfHealth(signal?: AbortSignal): Promise<PdfHealthReport> {
  return apiRequest('/pdf/health', { signal, responseSchema: pdfHealthSchema });
}

export async function fetchPdfTemplates(signal?: AbortSignal): Promise<TemplateSummary[]> {
  const { templates } = await apiRequest('/pdf/templates', {
    signal,
    responseSchema: templateListSchema,
  });
  return [...templates];
}

/**
 * El contrato de datos de un template.
 *
 * Es lo que convierte esta vista en algo que no hay que mantener: el formulario
 * se construye a partir de esta respuesta, así que un template nuevo —o un campo
 * añadido a uno existente— aparece solo. Sin esto, cada documento del motor
 * exigiría un formulario escrito a mano aquí y los dos se desincronizarían a la
 * primera.
 */
export function fetchPdfTemplateSchema(
  templateId: string,
  version?: string,
  signal?: AbortSignal,
): Promise<TemplateSchemaResult> {
  const query = version ? `?version=${encodeURIComponent(version)}` : '';
  return apiRequest(`/pdf/templates/${encodeURIComponent(templateId)}/schema${query}`, {
    signal,
    responseSchema: templateSchemaResultSchema,
  });
}

/**
 * Comprueba el payload sin generar nada.
 *
 * Existe para que el formulario pueda decir qué está mal ANTES de encargar un
 * documento: el motor es la autoridad —esta vista no revalida por su cuenta— y
 * un rechazo aquí cuesta una petición barata en vez de un renderizado entero.
 */
export function validateDocumentPayload(
  templateId: string,
  payload: unknown,
  version?: string,
): Promise<ValidationResult> {
  return apiRequest(`/pdf/templates/${encodeURIComponent(templateId)}/validate`, {
    method: 'POST',
    body: { payload, templateVersion: version },
    responseSchema: validationResultSchema,
  });
}

/**
 * Genera el documento y lo devuelve como archivo.
 *
 * Se pide con `accept: application/pdf`, que es lo que hace que el motor
 * responda el archivo en vez de la ficha. La descarga va por la puerta
 * autenticada y no por un `<a download>`: seguir un enlace es una navegación del
 * navegador, ahí no viaja el `Authorization` —el portal no tiene sesión por
 * cookie— y lo que se descargaría sería el 401.
 */
export function downloadGeneratedDocument(
  request: GenerateDocumentRequest,
): Promise<DownloadedFile> {
  /*
   * El nombre de reserva es el que pide quien llama, no el del template.
   *
   * El motor propone el suyo en `Content-Disposition` y ése manda; esto sólo decide qué pasa
   * cuando no lo manda. Antes, en ese caso, un informe de la ejecución REQ-1 se guardaba como
   * `generic-result-report.pdf`: el nombre del molde en lugar del nombre del documento, y diez
   * descargas seguidas se pisaban entre ellas en la carpeta de descargas.
   */
  return apiDownload('/pdf/generate', request.filename ?? `${request.templateId}.pdf`, {
    method: 'POST',
    headers: { accept: 'application/pdf' },
    body: {
      templateId: request.templateId,
      templateVersion: request.templateVersion,
      payload: request.payload,
      options: { filename: request.filename, returnContent: true },
    },
  });
}

/** La ficha del documento, sin el archivo. Para cuando sólo se quiere el registro. */
export function generateDocumentMetadata(
  request: GenerateDocumentRequest,
): Promise<GeneratedDocument> {
  return apiRequest('/pdf/generate', {
    method: 'POST',
    body: {
      templateId: request.templateId,
      templateVersion: request.templateVersion,
      payload: request.payload,
      options: { returnContent: false },
    },
    responseSchema: generatedDocumentSchema,
  });
}

/**
 * Vista previa con los datos de ejemplo del propio template.
 *
 * Pasa por el MISMO camino que la generación real, así que sirve para comprobar
 * la maqueta sin inventarse un payload. Nunca persiste.
 */
export function downloadTemplatePreview(
  templateId: string,
  version?: string,
): Promise<DownloadedFile> {
  return apiDownload('/pdf/preview', `vista-previa-${templateId}.pdf`, {
    method: 'POST',
    headers: { accept: 'application/pdf' },
    body: { templateId, templateVersion: version },
  });
}

/** Paquete de ejemplo del formato que el motor acepta para publicar templates. */
export function downloadTemplateFormatExample(): Promise<DownloadedFile> {
  return apiDownload('/pdf/template-format/example', 'template-de-ejemplo.json');
}

/**
 * Artefactos que pueden alimentar un documento.
 *
 * Sólo los que declaran contrato de salida: sin él no hay nada con lo que casar.
 * Responde 503 —no una lista vacía— cuando el generador corre suelto y no puede
 * consultarlos; la diferencia importa, porque una lista vacía se leería como
 * «este motor no tiene artefactos», que sería falso.
 */
export function fetchBindableArtifacts(signal?: AbortSignal): Promise<BindableArtifact[]> {
  return apiRequest('/pdf/artifacts', { signal, responseSchema: artifactListSchema }).then(
    (body) => [...body.artifacts],
  );
}

/** ¿Lo que responde este artefacto lo acepta este documento? */
export function fetchCompatibility(
  templateId: string,
  artifactId: string,
  signal?: AbortSignal,
): Promise<CompatibilityReport> {
  const path = `/pdf/templates/${encodeURIComponent(templateId)}/compatibility?artifact=${encodeURIComponent(artifactId)}`;
  return apiRequest(path, { signal, responseSchema: compatibilityReportSchema });
}

/**
 * Dato de prueba construido con la salida REAL del artefacto.
 *
 * Es lo que sustituye al ejemplo escrito a mano: un fixture inventado demuestra
 * que la plantilla maqueta, no que sirva para el artefacto que la va a usar.
 */
export function fetchArtifactSample(
  templateId: string,
  artifactId: string,
  signal?: AbortSignal,
): Promise<ArtifactSample> {
  const path = `/pdf/templates/${encodeURIComponent(templateId)}/sample?artifact=${encodeURIComponent(artifactId)}`;
  return apiRequest(path, { signal, responseSchema: artifactSampleSchema });
}
