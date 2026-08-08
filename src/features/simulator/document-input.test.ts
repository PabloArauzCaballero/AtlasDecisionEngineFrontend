import {
  acceptedFileTypes,
  documentInput,
  fileInputLabel,
  findDocumentSlot,
  isPdf,
  uploadLabel,
} from './document-input';
import type { ImportField } from './sample-import';

const field = (code: string, dataType = 'STRING', required = false): ImportField => ({
  code,
  dataType,
  required,
});

// El contrato real de EXTRACTO_CAPACIDAD_PAGO, leído de la traza del motor.
const EXTRACTO: ImportField[] = [
  field('extracto_pdf_base64', 'STRING', true),
  field('extracto_nombre_archivo', 'STRING'),
  field('cuota_solicitada_extracto', 'DECIMAL', true),
];

const SOLO_VALORES: ImportField[] = [
  field('monthly_income', 'DECIMAL', true),
  field('bureau_score', 'INTEGER', true),
];

describe('hueco documental del contrato', () => {
  it('reconoce la variable de documento y la del nombre de archivo', () => {
    expect(findDocumentSlot(EXTRACTO)).toEqual({
      contentCode: 'extracto_pdf_base64',
      fileNameCode: 'extracto_nombre_archivo',
    });
  });

  it('no encuentra ninguno donde el artefacto sólo recibe valores', () => {
    expect(findDocumentSlot(SOLO_VALORES)).toBeNull();
  });

  it('exige que la variable sea textual: un recuento de páginas no es un documento', () => {
    expect(findDocumentSlot([field('pdf_paginas', 'INTEGER')])).toBeNull();
  });

  it('no confunde una palabra que apenas contiene el término', () => {
    // `pdfs_revisados` no lleva `pdf` como palabra del código, sino pegado a otra.
    expect(findDocumentSlot([field('pdfs_revisados')])).toBeNull();
    expect(findDocumentSlot([field('documento_base64')])).not.toBeNull();
  });

  it('funciona sin variable de nombre de archivo', () => {
    expect(findDocumentSlot([field('adjunto_base64')])).toEqual({
      contentCode: 'adjunto_base64',
      fileNameCode: null,
    });
  });
});

describe('qué admite el selector de archivo', () => {
  it('añade PDF sólo donde el contrato puede recibirlo', () => {
    expect(acceptedFileTypes(EXTRACTO)).toContain('application/pdf');
    expect(acceptedFileTypes(SOLO_VALORES)).not.toContain('pdf');
  });

  it('siempre conserva JSON y CSV, que valen para cualquier artefacto', () => {
    for (const contract of [EXTRACTO, SOLO_VALORES]) {
      expect(acceptedFileTypes(contract)).toContain('.json');
      expect(acceptedFileTypes(contract)).toContain('.csv');
    }
  });

  it('el rótulo dice la verdad sobre lo que acepta', () => {
    expect(uploadLabel(EXTRACTO)).toBe('Subir JSON, CSV o PDF');
    expect(uploadLabel(SOLO_VALORES)).toBe('Subir JSON o CSV');
  });

  it('el nombre accesible conserva «archivo», que el rótulo se ahorra', () => {
    expect(fileInputLabel(SOLO_VALORES)).toBe('Subir archivo JSON o CSV con valores de prueba');
    expect(fileInputLabel(EXTRACTO)).toBe('Subir archivo JSON, CSV o PDF con valores de prueba');
  });
});

describe('carga del documento', () => {
  it('reconoce un PDF por tipo MIME y por extensión', () => {
    expect(isPdf(new File([''], 'x.bin', { type: 'application/pdf' }))).toBe(true);
    expect(isPdf(new File([''], 'EXTRACTO.PDF'))).toBe(true);
    expect(isPdf(new File([''], 'datos.csv', { type: 'text/csv' }))).toBe(false);
  });

  it('rellena contenido y nombre, y nada más', () => {
    const slot = { contentCode: 'extracto_pdf_base64', fileNameCode: 'extracto_nombre_archivo' };
    const file = new File([''], 'marzo.pdf');
    expect(documentInput(slot, file, 'JVBERi0x')).toEqual({
      extracto_pdf_base64: 'JVBERi0x',
      extracto_nombre_archivo: 'marzo.pdf',
    });
  });

  it('omite el nombre cuando el contrato no lo declara', () => {
    const slot = { contentCode: 'adjunto_base64', fileNameCode: null };
    expect(documentInput(slot, new File([''], 'x.pdf'), 'AA')).toEqual({ adjunto_base64: 'AA' });
  });
});
