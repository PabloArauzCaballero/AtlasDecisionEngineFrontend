/**
 * Veredicto que el motor simulado devuelve para el worker de identidad.
 *
 * Es un `REVIEW_REQUIRED` y no un `VERIFIED` a propósito: el veredicto limpio no
 * ejercita ni la lista de motivos ni las marcas de riesgo, que es donde vive
 * casi todo lo que la vista tiene que saber pintar. Copia la forma que publica
 * `IdentityVerificationOutcome`, con el número de documento ya enmascarado —tal
 * como sale del motor, no de la pantalla—.
 */
export const IDENTITY_RESULT = {
  decision: 'REVIEW_REQUIRED',
  reasonCodes: ['AMBIGUOUS_MATCH'],
  calibratedFaceDecision: 'REVIEW',
  thresholdProfileVersion: 'sintetico-60x3-fmr1e-3-fnmr1e-2',
  documentType: 'BOLIVIA_CI',
  documentCountry: 'BO',
  classification: { confidence: 0.94, signals: ['country=BO', 'identity-label'] },
  fields: {
    documentType: { value: 'BOLIVIA_CI', confidence: 1, source: 'DERIVED' },
    // El número y las fechas vienen de la MRZ —la fuente con dígitos de
    // control—; el nombre, de los rótulos del anverso, porque la MRZ trunca los
    // nombres a treinta caracteres. La vista tiene que distinguirlo.
    documentNumber: { value: '••••567', confidence: 0.98, source: 'MRZ' },
    fullName: { value: 'MARIA RENEE RODRIGUEZ GONZALEZ', confidence: 0.98, source: 'OCR' },
    firstNames: { value: 'MARIA RENEE', confidence: 0.98, source: 'OCR' },
    lastNames: { value: 'RODRIGUEZ GONZALEZ', confidence: 0.98, source: 'OCR' },
    dateOfBirth: { value: '2003-04-05', confidence: 0.98, source: 'MRZ' },
    expirationDate: { value: '2028-11-01', confidence: 0.98, source: 'MRZ' },
    nationality: { value: 'BOLIVIANA', confidence: 1, source: 'DERIVED' },
    country: { value: 'BO', confidence: 1, source: 'DERIVED' },
  },
  quality: {
    document: { score: 0.81, warnings: [] },
    selfie: { score: 0.78, warnings: [] },
  },
  liveness: { outcome: 'PASSED', score: 0.72, provider: 'human' },
  faceMatch: {
    similarityScore: 0.8203,
    comparable: true,
    provider: 'human',
    modelVersion: 'human-3.3.6/faceres-1024',
  },
  framing: { recortado: true, areaConservada: 0.324 },
  riskFlags: ['NAME_SPLIT_HEURISTIC'],
  providers: { ocr: 'tesseract', face: 'human', liveness: 'human' },
};
