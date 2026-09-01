/**
 * La cola de revisión de extractos, vista desde el portal.
 *
 * Espejo de `StatementReviewReason` / `StatementRejectionReason` del motor.
 * **No es autoritativo**: quien decide qué entra en la cola es el triage del
 * motor (`statement-outcome.ts`), y el portal sólo lo nombra en español.
 *
 * La distinción que sostiene toda la pantalla: un documento RECHAZADO no es un
 * pendiente. Nunca aparece aquí —el motor no lo devuelve— y su sitio es el
 * historial, marcado como rechazado. Una cola con documentos obviamente
 * inválidos dentro deja de revisarse.
 */

/** Por qué un caso espera a una persona. Son las pestañas de la cola. */
export const REVIEW_REASONS = [
  'TIMEOUT',
  'LOW_CONFIDENCE',
  'DOUBTFUL_DOCUMENT',
  'UNKNOWN_BANK',
  'PARTIAL_EXTRACTION',
  'AMBIGUOUS_DATA',
  'OCR_ERROR',
  'MANUAL_REQUEST',
  'SUSPECTED_TAMPERING',
] as const;

export type StatementReviewReason = (typeof REVIEW_REASONS)[number];

export const REVIEW_REASON_LABEL: Record<StatementReviewReason, string> = {
  TIMEOUT: 'Timeout',
  LOW_CONFIDENCE: 'Baja confianza',
  DOUBTFUL_DOCUMENT: 'Documento dudoso',
  UNKNOWN_BANK: 'Banco no reconocido',
  PARTIAL_EXTRACTION: 'Extracción parcial',
  AMBIGUOUS_DATA: 'Datos ambiguos',
  OCR_ERROR: 'Error de lectura',
  MANUAL_REQUEST: 'Revisión manual',
  SUSPECTED_TAMPERING: 'Indicios de edición',
};

/** Qué hay que hacer con cada categoría. Se enseña junto a la lista. */
export const REVIEW_REASON_HELP: Record<StatementReviewReason, string> = {
  TIMEOUT:
    'El procesamiento tardó más de lo aceptable. El documento sigue siendo válido: lo habitual es reprocesarlo.',
  LOW_CONFIDENCE:
    'Se extrajeron movimientos y la confianza quedó por debajo del corte. Hay que contrastar lo extraído con el PDF antes de darlo por bueno.',
  DOUBTFUL_DOCUMENT:
    'Se parece a un extracto y las señales no bastaron para confirmarlo. Si no lo es, márcalo como PDF no válido.',
  UNKNOWN_BANK:
    'Es un extracto y no se reconoció la entidad, o su formato no tiene analizador verificado. Sirve para saber qué formato falta soportar.',
  PARTIAL_EXTRACTION: 'Se reconoció el documento y no se obtuvieron movimientos utilizables.',
  AMBIGUOUS_DATA:
    'Los saldos o totales que imprime el banco no cuadran con lo leído. Es el caso más delicado: hay dato y contradice al documento.',
  OCR_ERROR: 'No hay capa de texto aprovechable. Suele ser un escaneo o una foto del extracto.',
  MANUAL_REQUEST: 'Alguien lo mandó a revisar a mano.',
  SUSPECTED_TAMPERING:
    'El archivo muestra señales de haberse tocado después de emitirse y ninguna es concluyente: una impresión desde el navegador, una reescritura, metadatos borrados. Es la franja donde rechazar castigaría a un cliente honesto y aceptar sería mirar a otro lado.',
};

/** Por qué se rechazó un documento. Nunca aparecen en la cola: sólo en historial. */
export const REJECTION_REASONS = [
  'NOT_BANK_STATEMENT',
  'UNSUPPORTED_FILE',
  'EMPTY_DOCUMENT',
  'CORRUPTED_PDF',
  'UNREADABLE_DOCUMENT',
  'TAMPERED_DOCUMENT',
  'ACTIVE_CONTENT',
  'INSUFFICIENT_PERIOD',
  'STALE_PERIOD',
] as const;

export type StatementRejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_REASON_LABEL: Record<StatementRejectionReason, string> = {
  NOT_BANK_STATEMENT: 'No es un extracto bancario',
  UNSUPPORTED_FILE: 'Archivo no admitido',
  EMPTY_DOCUMENT: 'Documento vacío',
  CORRUPTED_PDF: 'PDF dañado',
  UNREADABLE_DOCUMENT: 'PDF ilegible o protegido',
  TAMPERED_DOCUMENT: 'Documento manipulado',
  ACTIVE_CONTENT: 'PDF con contenido ejecutable',
  INSUFFICIENT_PERIOD: 'Periodo insuficiente',
  STALE_PERIOD: 'Extracto vencido',
};

/**
 * Lo que se le dice al usuario cuando su documento se rechaza.
 *
 * Una frase por motivo y todas ACCIONABLES: «No se pudo procesar» y «Documento
 * pendiente» describen el estado del sistema y no lo que hay que hacer, y sobre
 * un rechazo con evidencia suficiente son además falsas —el sistema sí supo qué
 * pasaba—.
 */
export const REJECTION_ADVICE: Record<StatementRejectionReason, string> = {
  NOT_BANK_STATEMENT:
    'El documento cargado no parece corresponder a un extracto bancario. Verifica el archivo e inténtalo nuevamente.',
  UNSUPPORTED_FILE: 'El archivo no es un PDF admitido, o supera el tamaño máximo.',
  EMPTY_DOCUMENT: 'El archivo está vacío o no contiene ninguna página.',
  CORRUPTED_PDF: 'El PDF está dañado y no se pudo abrir. Vuelve a descargarlo del banco.',
  UNREADABLE_DOCUMENT: 'El PDF está protegido con contraseña. Sube una versión sin protección.',
  /*
   * Los tres de ADMISIÓN, y cada uno con SU acción.
   *
   * Es la razón de que sean tres motivos y no uno: quien subió una factura tiene que subir OTRO
   * documento, quien subió un PDF editado tiene que subir el MISMO sin editar, y quien subió un mes
   * tiene que subir el mismo con más meses. Con una sola frase, los tres volvían a subir el mismo
   * archivo hasta rendirse.
   *
   * El de manipulación NO dice qué señal lo delató: contárselo a quien editó el documento es
   * enseñarle qué evitar la próxima vez, y a quien no lo editó no le sirve de nada. El detalle
   * técnico está en el detalle de la ejecución, para quien audita.
   */
  TAMPERED_DOCUMENT:
    'El archivo fue compuesto o editado con otro programa: no es el PDF que emite el banco. Hay que subir el mismo extracto tal como se descarga de la banca por internet, sin abrirlo ni volver a guardarlo.',
  ACTIVE_CONTENT:
    'El PDF contiene elementos ejecutables o archivos incrustados. No se abre: hay que descargar el extracto otra vez de la banca por internet.',
  INSUFFICIENT_PERIOD:
    'El extracto es válido y cubre menos de 3 meses completos. Con menos tiempo, un ingreso extraordinario o un gasto puntual bastan para desviar el cálculo, así que no hay capacidad de pago que calcular: hay que pedir el periodo de los últimos 3 meses.',
  /*
   * El vencido es la CONTRARIA del insuficiente, y por eso tiene motivo propio aunque los dos
   * hablen del periodo: al corto le faltan meses hacia atrás y al vencido le falta el presente.
   * Decirle «consigue tres meses» a quien subió doce cerrados en marzo es pedirle justo lo que no
   * le falta, y es la clase de mensaje que hace que alguien vuelva a subir el mismo archivo.
   */
  STALE_PERIOD:
    'El extracto es válido y su último movimiento es demasiado antiguo: ya no describe la situación actual. Hay que descargar de la banca por internet el extracto hasta la fecha de hoy y volver a subirlo.',
};

export const REVIEW_PRIORITY_LABEL: Record<number, string> = {
  1: 'Alta',
  2: 'Media',
  3: 'Baja',
};

/** Un caso de la cola, tal como lo publica el motor. */
export interface StatementReviewItem {
  requestId: string;
  fileName: string;
  requestedBy: string;
  status: 'PENDING_REVIEW' | 'IN_REVIEW';
  reviewReason: StatementReviewReason;
  reviewPriority: number;
  errorCode: string | null;
  errorMessage: string | null;
  institutionId: string | null;
  documentTypeConfidence: number | null;
  extractionConfidence: number | null;
  transactionCount: number | null;
  reviewOpenedAt: string | null;
  /**
   * Cuánto lleva esperando, medido por el MOTOR. No se deriva aquí de
   * `reviewOpenedAt`: el reloj del navegador puede ir desfasado y la cifra
   * resultante ordenaría mal una cola sin que nada lo delatara.
   */
  pendingMs: number | null;
  reviewClaimedBy: string | null;
  reviewClaimedAt: string | null;
  queuedAt: string;
}

/** El caso abierto: lo de la lista, más lo que hace falta para decidirlo. */
export interface StatementReviewDetail extends StatementReviewItem {
  result?: unknown;
  warnings?: unknown;
  fileHash: string;
  fileSizeBytes: number;
  correlationId: string;
  attemptCount: number;
  reviewNotes: string | null;
  /** Si el PDF original sigue guardado. Sin él no se puede reprocesar. */
  documentAvailable: boolean;
}

/** Contador de una pestaña. `category: null` es «Todos». */
export interface StatementReviewCategory {
  category: StatementReviewReason | null;
  total: number;
  claimed: number;
  oldestPendingMs: number | null;
}

export const REVIEW_ACTIONS = ['APPROVE', 'CORRECT', 'REJECT', 'MARK_INVALID'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const REVIEW_ACTION_LABEL: Record<ReviewAction, string> = {
  APPROVE: 'Aprobar',
  CORRECT: 'Corregir',
  REJECT: 'Rechazar',
  MARK_INVALID: 'Marcar como PDF no válido',
};

/** Espera legible. Sube de unidad al pasar la hora y el día. */
export function pendingLabel(ms: number | null): string {
  if (ms === null) return '—';
  const minutos = Math.floor(ms / 60_000);
  if (minutos < 60) return `${String(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${String(horas)} h ${String(minutos % 60)} min`;
  return `${String(Math.floor(horas / 24))} d ${String(horas % 24)} h`;
}

/** Porcentaje, o «—» cuando la medida no se pudo tomar. `null` no es cero. */
export function confidenceLabel(value: number | null): string {
  return value === null ? '—' : `${String(Math.round(value * 100))} %`;
}
