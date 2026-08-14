/**
 * Resultados que el motor simulado devuelve al terminar cada worker.
 *
 * Viven aparte del enrutado porque son lo más voluminoso del simulado y lo que
 * más cambia: cada campo nuevo del contrato aterriza aquí. Mezclados con las
 * rutas, el archivo crecía por encima del límite de longitud del repositorio y
 * costaba ver dónde acababa el dato y empezaba el comportamiento.
 */

export const SEMANTIC_RESULT = {
  requestId: 'run-semantico',
  status: 'MATCH',
  normalizedText: 'compra en supermercado hipermaxi sucursal norte bs 487,90',
  entities: [
    {
      type: 'MONEDA',
      canonicalName: 'Boliviano',
      sourceText: 'Bs',
      confidence: 0.9,
    },
  ],
  matches: [
    {
      categoryCode: 'GASTOS.ALIMENTACION.SUPERMERCADO',
      confidence: 0.91,
      supported: true,
      contradicted: false,
      // El respaldo de un codificador es el texto entero: no hay una frase que
      // pese más que otra, porque el vector se calcula sobre todo él.
      evidence: ['compra en supermercado hipermaxi sucursal norte bs 487,90'],
      rationale:
        'Se parece a «COMPRA EN SUPERMERCADO» (similitud 0,94). Confianza calibrada: 0,91.',
    },
  ],
  evaluatedCategoryCodes: ['GASTOS.ALIMENTACION.SUPERMERCADO', 'GASTOS.ALIMENTACION.RESTAURANTES'],
  /*
   * La ruta la resuelve el motor, que es quien tiene el árbol entero: los
   * ancestros de una hoja no están entre los candidatos, así que la vista no
   * podría reconstruirla sin partir el código por puntos.
   */
  categoryPaths: {
    'GASTOS.ALIMENTACION.SUPERMERCADO': ['Gastos', 'Alimentación', 'Supermercado y mercado'],
    'GASTOS.ALIMENTACION.RESTAURANTES': ['Gastos', 'Alimentación', 'Restaurantes y delivery'],
  },
  tierUsed: 'FAST',
  model: 'intfloat/multilingual-e5-small',
  modelVersion: 'intfloat/multilingual-e5-small@fast',
  processingTimeMs: 184,
};

export const STATEMENT_RESULT = {
  source: { fileName: 'extracto.pdf', fileHash: 'abc123', pageCount: 1, extractionMethod: 'TEXT' },
  institution: {
    id: 'BGA',
    name: 'Banco Ganadero S.A.',
    normalizedName: 'banco ganadero',
    country: 'BO',
    detected: true,
    confidence: 0.98,
  },
  // Enmascarada SIEMPRE: la vista no debe poder enseñar un número completo ni
  // aunque el motor se equivocara, y esto lo deja comprobable desde la prueba.
  account: {
    holderName: 'CLIENTE DE PRUEBA',
    accountNumberMasked: '******7890',
    accountType: 'CORRIENTE',
    currency: 'BOB',
    allAccountsMasked: ['******7890'],
  },
  period: { from: '2026-03-01', to: '2026-03-31' },
  balances: { opening: 10000, closing: 11250 },
  totals: { debit: 250, credit: 1500 },
  processing: {
    documentType: 'BANK_STATEMENT',
    strategyId: 'generic:table-inference-v1',
    strategyKind: 'GENERIC',
    strategyVersion: '1',
    detectionReasons: [],
    durationMs: 2868,
  },
  transactions: [
    {
      id: 't1',
      index: 0,
      transactionDate: '2026-03-02',
      valueDate: null,
      description: 'PAGO SERVICIOS (CUOTA 3)',
      reference: null,
      documentNumber: null,
      debit: 250,
      credit: null,
      amount: -250,
      balance: 9750,
      currency: 'BOB',
      movementType: 'DEBIT',
      channel: null,
      branch: null,
      rawText: null,
      accountMasked: '******7890',
    },
    {
      id: 't2',
      index: 1,
      transactionDate: '2026-03-05',
      valueDate: null,
      description: 'DEPOSITO EN EFECTIVO',
      reference: null,
      documentNumber: null,
      debit: null,
      credit: 1500,
      amount: 1500,
      balance: 11250,
      currency: 'BOB',
      movementType: 'CREDIT',
      channel: null,
      branch: null,
      rawText: null,
      accountMasked: '******7890',
    },
  ],
  quality: {
    documentConfidence: 0.95,
    institutionConfidence: 0.98,
    structureConfidence: 0.9,
    reconciliationConfidence: 1,
    overallConfidence: 0.92,
    band: 'ALTA',
    checksRun: 6,
    checksPassed: 6,
    warnings: ['renglones-no-atribuidos:1'],
    errors: [],
  },
};

/**
 * Resultado de una locución servida DEL RESPALDO.
 *
 * No el camino feliz a propósito: `FALLBACK` es el desenlace que más fácil se
 * confunde con un éxito —hay audio, suena— y es justo el que la vista tiene que
 * distinguir. Con `READY` la prueba no mediría nada que un `SUCCEEDED` no
 * midiera ya.
 */
export const AUDIO_RESULT = {
  outcome: 'FALLBACK',
  cacheHit: false,
  generated: false,
  audioAvailable: true,
  reason: 'Se agotó el cupo de locuciones de hoy para esta cuenta.',
  templateCode: 'onboarding.fallback.generic',
  templateVersion: 1,
  language: 'es-419',
  provider: 'fake',
  model: 'eleven_v3',
  voiceProfile: 'brand_es_latam_v1',
  voiceVersion: 1,
  outputFormat: 'mp3_44100_128',
  sampleRate: 44100,
  mimeType: 'audio/mpeg',
  bytes: 48384,
  checksumSha256: 'c'.repeat(64),
};
