import type { ImportField } from './sample-import';

/**
 * Artefactos que reciben un documento, y cómo reconocerlos.
 *
 * El catálogo de tipos (`contracts/data-types.ts`) no tiene `FILE` ni
 * `DOCUMENT`: un PDF viaja como TEXTO en base64, que es lo que declara el
 * contrato real de `EXTRACTO_CAPACIDAD_PAGO` —`extracto_pdf_base64` junto a
 * `extracto_nombre_archivo`—. Así que «cuándo corresponde subir un PDF» no se
 * puede leer del `dataType`: se lee del CÓDIGO de la variable.
 *
 * Reconocer por nombre es más débil que un tipo declarado, y por eso el criterio
 * es estrecho —`base64` o `pdf` como palabra del código— en vez de cualquier
 * cosa que suene a archivo. Una lista de artefactos escrita a mano sería peor:
 * se desfasa en silencio el día que alguien crea el segundo.
 *
 * Cuando el backend declare un tipo de dato para documentos, esto se sustituye
 * por esa comprobación y el resto de la vista no cambia.
 */

const DOCUMENT_CODE = /(^|_)(pdf|base64)(_|$)/i;
const FILE_NAME_CODE = /(^|_)(nombre_archivo|filename|file_name|archivo)(_|$)/i;
const TEXTUAL = new Set(['STRING', 'LONG_TEXT', 'TEXT', 'CODE', 'IDENTIFIER']);

export interface DocumentSlot {
  /** Variable que recibe el contenido del archivo en base64. */
  contentCode: string;
  /** Variable que recibe el nombre del archivo, si el contrato la declara. */
  fileNameCode: string | null;
}

function isTextual(dataType: string): boolean {
  return TEXTUAL.has(dataType.trim().toUpperCase());
}

/**
 * Hueco documental del contrato, o `null` si este artefacto no recibe archivos.
 *
 * Se exige que la variable sea textual además de llamarse como se llama: un
 * `pdf_paginas` de tipo entero es un recuento, no un documento.
 */
export function findDocumentSlot(contract: readonly ImportField[]): DocumentSlot | null {
  const content = contract.find(
    (field) => DOCUMENT_CODE.test(field.code) && isTextual(field.dataType),
  );
  if (!content) return null;

  const fileName = contract.find(
    (field) =>
      field.code !== content.code && FILE_NAME_CODE.test(field.code) && isTextual(field.dataType),
  );
  return { contentCode: content.code, fileNameCode: fileName?.code ?? null };
}

/** Tipos que el selector de archivo admite para ESTE artefacto. */
export function acceptedFileTypes(contract: readonly ImportField[]): string {
  const base = '.json,.csv,application/json,text/csv';
  return findDocumentSlot(contract) ? `${base},.pdf,application/pdf` : base;
}

/** Formatos admitidos, en prosa: sirve al rótulo y al nombre accesible. */
export function uploadFormats(contract: readonly ImportField[]): string {
  return findDocumentSlot(contract) ? 'JSON, CSV o PDF' : 'JSON o CSV';
}

/** Rótulo del botón, para que diga la verdad sobre lo que admite. */
export function uploadLabel(contract: readonly ImportField[]): string {
  return `Subir ${uploadFormats(contract)}`;
}

/**
 * Nombre accesible del selector.
 *
 * Conserva la palabra «archivo» que el rótulo del botón se ahorra: fuera de
 * contexto, «Subir JSON o CSV» no dice que abra un selector de archivos.
 */
export function fileInputLabel(contract: readonly ImportField[]): string {
  return `Subir archivo ${uploadFormats(contract)} con valores de prueba`;
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * Contenido del archivo en base64, SIN el prefijo `data:` del lector.
 *
 * El contrato pide el documento en base64 a secas; mandar
 * `data:application/pdf;base64,JVBER…` haría que el motor intentara decodificar
 * la cabecera como parte del PDF y devolviera un extracto ilegible sin decir por
 * qué. Se corta aquí, que es donde se sabe que está.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/** Valores que un documento aporta al formulario, listos para cargar. */
export function documentInput(
  slot: DocumentSlot,
  file: File,
  base64: string,
): Record<string, unknown> {
  const input: Record<string, unknown> = { [slot.contentCode]: base64 };
  if (slot.fileNameCode) input[slot.fileNameCode] = file.name;
  return input;
}
