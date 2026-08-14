/**
 * Resultado del worker de verificación de identidad, visto desde el portal.
 *
 * Espejo de `IdentityVerificationOutcome` en el motor. **No es autoritativo**:
 * sirve para pintar. El motor decide, enmascara y revalida siempre.
 */

export type IdentityDecision = 'VERIFIED' | 'REVIEW_REQUIRED' | 'NOT_VERIFIED' | 'INCONCLUSIVE';

export interface IdentityField {
  value: string | null;
  confidence: number | null;
  source: string;
}

export interface IdentityOutcome {
  decision: IdentityDecision;
  reasonCodes: string[];
  calibratedFaceDecision: 'MATCH' | 'REVIEW' | 'NO_MATCH' | 'UNAVAILABLE';
  thresholdProfileVersion: string;
  documentType: string;
  documentCountry: string;
  classification?: { confidence: number; signals: string[] };
  fields: Record<string, IdentityField | undefined>;
  quality: {
    document: { score: number; warnings: string[] };
    selfie: { score: number; warnings: string[] };
  };
  liveness: { outcome: string; score?: number; provider: string };
  faceMatch: {
    similarityScore: number | null;
    comparable: boolean;
    notComparableReason?: string;
    provider: string;
    modelVersion?: string;
  } | null;
  /** Si se leyó el documento recortado del fondo, o la foto entera. */
  framing?: { recortado: boolean; areaConservada: number };
  riskFlags: string[];
  providers: { ocr: string; face: string; liveness: string };
}

/**
 * Qué significa cada veredicto, en una frase.
 *
 * «No concluyente» es el que más falta hace: sin explicarlo se lee como un
 * rechazo suave, y es lo contrario —significa que no se pudo mirar, no que la
 * persona no sea quien dice—.
 */
export const DECISION_LABEL: Record<IdentityDecision, string> = {
  VERIFIED: 'Verificado',
  REVIEW_REQUIRED: 'Requiere revisión',
  NOT_VERIFIED: 'No verificado',
  INCONCLUSIVE: 'No concluyente',
};

export const DECISION_HELP: Record<IdentityDecision, string> = {
  VERIFIED: 'El rostro del documento y la selfie coinciden por encima del umbral calibrado.',
  REVIEW_REQUIRED:
    'Hay señales que nadie puede resolver automáticamente. Una persona tiene que mirarlo antes de decidir.',
  NOT_VERIFIED:
    'Se rechaza: o el rostro no coincide, o la prueba de vida falló, o el documento ya caducó.',
  INCONCLUSIVE:
    'No se pudo comparar. Esto NO afirma que sea otra persona: falta la comparación, no el parecido.',
};

/** Tono que `StatusBadge` ya sabe colorear. Vocabulario cerrado, no tonos nuevos. */
export function decisionTone(decision: IdentityDecision): string {
  if (decision === 'VERIFIED') return 'PASSED';
  if (decision === 'NOT_VERIFIED') return 'FAILED';
  if (decision === 'INCONCLUSIVE') return 'INACTIVE';
  return 'WARNING';
}

/**
 * Códigos de motivo del motor, en español.
 *
 * Se traducen aquí y no en el motor porque el código es el contrato —viaja a
 * auditoría y a cualquier otro cliente— y la frase es de esta pantalla. Un
 * código que no esté en el mapa se enseña tal cual: mejor un código crudo que
 * esconder un motivo que nadie tradujo todavía.
 */
export const REASON_LABEL: Record<string, string> = {
  LIVENESS_FAILED: 'La prueba de vida no se superó',
  DOCUMENT_EXPIRED: 'El documento está caducado',
  LOW_DOCUMENT_CONFIDENCE: 'La foto del documento tiene poca calidad',
  LOW_FACE_QUALITY: 'El rostro de la selfie tiene poca calidad',
  DOCUMENT_FIELD_INCONSISTENCY: 'No se pudieron leer los campos obligatorios del documento',
  DOCUMENT_EXPIRY_UNKNOWN: 'No se pudo leer la fecha de caducidad',
  LIVENESS_UNCERTAIN: 'La prueba de vida no fue concluyente',
  FACE_MATCH_UNAVAILABLE: 'No se pudo comparar los dos rostros',
  // Los tres motivos por los que el proveedor puede negarse a comparar. Sin
  // ellos, la ficha del parecido enseñaba el código crudo justo donde hace
  // falta explicar por qué no hay cifra.
  NO_FACE_IN_DOCUMENT: 'No se encontró un rostro utilizable en el documento',
  NO_FACE_IN_SELFIE: 'No se encontró un rostro utilizable en la selfie',
  PROVIDER_REJECTED_INPUT: 'El proveedor rechazó las imágenes',
  THRESHOLD_PROFILE_MISSING: 'Este motor no tiene umbrales calibrados configurados',
  FACE_NO_MATCH: 'Los rostros no coinciden',
  AMBIGUOUS_MATCH: 'El parecido queda entre los dos umbrales',
  MULTIPLE_FACES: 'Se detectó más de un rostro en el documento',
  NAME_SPLIT_HEURISTIC: 'Nombres y apellidos se separaron por convención, no por el documento',
  DOCUMENT_NUMBER_NOT_FOUND: 'No se encontró el número de documento',
  NAME_NOT_FOUND: 'No se encontró el nombre del titular',
  DATE_OF_BIRTH_NOT_FOUND: 'No se encontró la fecha de nacimiento',
  DOCUMENT_EXPIRY_NOT_FOUND: 'No se encontró la fecha de caducidad',
  DATE_OF_BIRTH_UNPARSABLE: 'La fecha de nacimiento no se pudo interpretar',
  DOCUMENT_EXPIRY_UNPARSABLE: 'La fecha de caducidad no se pudo interpretar',
  DOCUMENT_SIDES_MISMATCH: 'El anverso y el reverso no son del mismo documento',
  DOCUMENT_MRZ_MISMATCH: 'El texto impreso y la zona de lectura mecánica no dicen lo mismo',
  DOCUMENT_MRZ_CHECK_FAILED: 'La zona de lectura mecánica se leyó, pero su control no cuadra',
  GENERIC_PARSER_USED: 'Se usó el analizador genérico: ese tipo de documento no tiene uno propio',
  MRZ_NOT_FOUND: 'No se encontró la zona de lectura mecánica',
  LOW_RESOLUTION: 'La imagen tiene poca resolución',
  UNDEREXPOSED: 'La imagen está subexpuesta',
  OVEREXPOSED: 'La imagen está sobreexpuesta',
  LOW_CONTRAST: 'La imagen tiene poco contraste',
  POSSIBLE_BLUR: 'La imagen puede estar movida',
  QUALITY_SCORE_TOO_LOW: 'La calidad global queda por debajo del mínimo',
  FACE_TOO_SMALL: 'El rostro ocupa muy poco del encuadre',
  /*
   * La marca que distingue un escenario de una verificación de verdad.
   *
   * Las imágenes de un escenario las fabrica el motor, y una imagen fabricada no
   * es una captura en vivo: la prueba de vida no se ejecuta sobre ella en vez de
   * fingir que la superó. Sin este aviso a la vista, un «VERIFICADO» de la demo
   * se leería igual que uno de una persona ante la cámara.
   */
  GENERATED_INPUT_NO_LIVENESS:
    'Escenario de prueba: la imagen la generó el motor, así que no se ejecutó la prueba de vida',
};

/** Nombre legible de cada campo leído del documento. */
export const FIELD_LABEL: Record<string, string> = {
  documentType: 'Tipo de documento',
  documentNumber: 'Número',
  fullName: 'Nombre completo',
  firstNames: 'Nombres',
  lastNames: 'Apellidos',
  dateOfBirth: 'Fecha de nacimiento',
  expirationDate: 'Válido hasta',
  issueDate: 'Fecha de emisión',
  placeOfBirth: 'Lugar de nacimiento',
  nationality: 'Nacionalidad',
  country: 'País emisor',
  sex: 'Sexo',
};
