/**
 * La cola de arbitraje de identidad, vista desde el portal.
 *
 * Espejo de `IdentityReviewReason` / `IdentityRejectionReason` del motor.
 * **No es autoritativo**: quien decide qué entra en la cola es la puerta de
 * documentos del motor (`identity-triage.ts`), y el portal sólo lo nombra en
 * español y dice qué hacer con cada caso.
 *
 * La distinción que sostiene toda la pantalla: una imagen RECHAZADA no es un
 * pendiente. Nunca aparece aquí —el motor no la devuelve por esta ruta— y su
 * sitio es el historial, marcada como rechazada. Poner delante de una persona la
 * foto de un recibo le cuesta el mismo minuto que un caso real y no desbloquea a
 * nadie: el trabajo que lo arregla sólo puede hacerlo quien subió la foto.
 */

/** Por qué un caso espera a una persona. Son las pestañas de la cola. */
export const IDENTITY_REVIEW_REASONS = [
  'DOUBTFUL_DOCUMENT',
  'UNRECOGNIZED_DOCUMENT_TYPE',
  'AMBIGUOUS_FACE_MATCH',
  'LOW_IMAGE_QUALITY',
  'TIMEOUT',
  'MANUAL_REQUEST',
] as const;

export type IdentityReviewReason = (typeof IDENTITY_REVIEW_REASONS)[number];

export const IDENTITY_REASON_LABEL: Record<IdentityReviewReason, string> = {
  DOUBTFUL_DOCUMENT: 'Documento dudoso',
  UNRECOGNIZED_DOCUMENT_TYPE: 'Tipo sin reconocer',
  AMBIGUOUS_FACE_MATCH: 'Parecido ambiguo',
  LOW_IMAGE_QUALITY: 'Captura pobre',
  TIMEOUT: 'Timeout',
  MANUAL_REQUEST: 'Revisión manual',
};

/** Qué hay que hacer con cada categoría. Se enseña junto a la lista. */
export const IDENTITY_REASON_HELP: Record<IdentityReviewReason, string> = {
  DOUBTFUL_DOCUMENT:
    'Se parece a un documento de identidad y las señales no bastaron para confirmarlo. Si lo es, confírmalo indicando cuál; si no, recházalo.',
  UNRECOGNIZED_DOCUMENT_TYPE:
    'Hay evidencia sobrada de que es un documento de identidad, pero el motor no supo cuál. Es el caso que más rápido se resuelve mirando: basta con nombrar el tipo.',
  AMBIGUOUS_FACE_MATCH:
    'El parecido cayó entre los dos umbrales calibrados. El motor no lo resuelve a la fuerza: lo deja aquí para que una persona mire la evidencia.',
  LOW_IMAGE_QUALITY:
    'La captura tiene defectos que no impidieron leer, pero sí decidir. Si el documento se distingue, confírmalo.',
  TIMEOUT:
    'El proceso superó su presupuesto de tiempo. El documento sigue siendo válido: lo habitual es confirmarlo y dejar que se reanude.',
  MANUAL_REQUEST: 'Alguien lo mandó a arbitrar a mano.',
};

/** Por qué se rechaza un documento. Es obligatorio elegir uno al rechazar. */
export const IDENTITY_REJECTION_REASONS = [
  'NOT_AN_IDENTITY_DOCUMENT',
  'UNSUPPORTED_DOCUMENT_TYPE',
  'UNREADABLE_DOCUMENT',
] as const;

export type IdentityRejectionReason = (typeof IDENTITY_REJECTION_REASONS)[number];

export const IDENTITY_REJECTION_LABEL: Record<IdentityRejectionReason, string> = {
  NOT_AN_IDENTITY_DOCUMENT: 'No es un documento de identidad',
  UNSUPPORTED_DOCUMENT_TYPE: 'Es un documento que este trámite no admite',
  UNREADABLE_DOCUMENT: 'Es un documento y no hay forma de leerlo',
};

/** Tipos que se pueden confirmar. Sin tipo no hay analizador. */
export const IDENTITY_CONFIRMABLE_TYPES = ['BOLIVIA_CI', 'PASSPORT', 'DRIVER_LICENSE'] as const;

export type IdentityConfirmableType = (typeof IDENTITY_CONFIRMABLE_TYPES)[number];

export const IDENTITY_TYPE_LABEL: Record<IdentityConfirmableType, string> = {
  BOLIVIA_CI: 'Cédula de identidad (Bolivia)',
  PASSPORT: 'Pasaporte',
  DRIVER_LICENSE: 'Licencia de conducir',
};

export interface IdentityReviewItem {
  requestId: string;
  requestedBy: string;
  status: 'PENDING_REVIEW' | 'IN_REVIEW';
  reviewReason: IdentityReviewReason;
  reviewPriority: number | null;
  arbitrationMode: string | null;
  documentType: string | null;
  documentCountry: string;
  documentTypeConfidence: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  reviewOpenedAt: string | null;
  pendingMs: number | null;
  reviewClaimedBy: string | null;
  reviewClaimedAt: string | null;
  queuedAt: string;
}

export interface IdentityReviewCategory {
  category: IdentityReviewReason | null;
  total: number;
  claimed: number;
  oldestPendingMs: number | null;
}

/**
 * Cuánto lleva esperando, en palabras.
 *
 * Se dice en la unidad que corresponde y no en milisegundos: «hace 3 h» se lee
 * de un vistazo y `11.243.918` no significa nada para quien tiene que decidir
 * qué mira primero.
 */
export function pendingLabel(ms: number | null): string {
  if (ms === null) return 'sin fecha';
  const minutos = Math.floor(ms / 60_000);
  if (minutos < 1) return 'hace menos de un minuto';
  if (minutos < 60) return `hace ${String(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${String(horas)} h`;
  return `hace ${String(Math.floor(horas / 24))} d`;
}
