/**
 * Catálogo, escenarios y plantillas del motor simulado de workers.
 *
 * Hoja aparte de `workers-backend.ts` porque aquélla se pasó del tope de 299
 * líneas del repositorio al entrar el cuarto worker. Aquí vive lo que el motor
 * PUBLICA —datos—; allí, cómo responde —comportamiento—.
 */

/**
 * Catálogo: es lo que gobierna límites y disponibilidad en la vista.
 *
 * Array desnudo, NO `{ items }`. Es la convención del motor para colecciones no
 * paginadas (`ApiArrayResponse`), y el simulado la tenía mal: envolvía la
 * respuesta y por eso el E2E pasaba contra un contrato que el motor real no
 * sirve. Lo destapó el smoke por HTTP, no esta prueba.
 */
export const CATALOG = [
  {
    code: 'semantic-analysis',
    name: 'Clasificación de gastos',
    description:
      'Clasifica la descripción de un movimiento contra el árbol de categorías de gasto e ingreso.',
    acceptedInputs: ['Texto libre', 'Escenario de prueba'],
    limits: { maxTextLength: 8000 },
    available: true,
    fixturesEnabled: true,
  },
  {
    code: 'bank-statement',
    name: 'Extractos bancarios',
    description: 'Convierte un extracto boliviano en PDF a movimientos normalizados.',
    acceptedInputs: ['Archivo PDF', 'Escenario de prueba'],
    limits: { maxUploadBytes: 10485760, maxFiles: 1, acceptedMimeTypes: 'application/pdf' },
    available: true,
    fixturesEnabled: true,
  },
  {
    code: 'identity-verification',
    name: 'Verificación de identidad',
    description:
      'Compara la foto de un documento de identidad con una selfie y decide si son la misma persona.',
    acceptedInputs: ['Imagen del documento', 'Selfie', 'Escenario de prueba'],
    limits: {
      maxUploadBytes: 10485760,
      maxFiles: 3,
      acceptedMimeTypes: 'image/jpeg, image/png, image/webp',
      // El proveedor y el perfil de umbrales VIAJAN en el catálogo: la vista los
      // enseña porque la lectura es real pero la comparación de rostros no, y
      // sin perfil calibrado todo termina en revisión.
      ocrProvider: 'tesseract',
      faceProvider: 'human',
      livenessProvider: 'human',
      thresholdProfile: 'sintetico-60x3-fmr1e-3-fnmr1e-2',
    },
    available: true,
    fixturesEnabled: true,
  },
  {
    code: 'audio-tts',
    name: 'Locución',
    description: 'Convierte en voz una plantilla del catálogo, rellenando sus variables.',
    acceptedInputs: ['Plantilla del catálogo', 'Escenario de prueba'],
    limits: {
      maxTextLength: 5000,
      // El proveedor VIAJA en el catálogo: `fake` sintetiza un audio que no es
      // una voz, y la vista tiene que poder decirlo.
      provider: 'fake',
      voiceProfile: 'brand_es_latam_v1',
      outputFormat: 'mp3_44100_128',
      monthlyBudgetUnits: 10000,
      generationsPerActorDay: 3,
    },
    available: true,
    fixturesEnabled: true,
  },
];

/** Las plantillas del tenant. La consola de locución no tiene texto libre. */
export const AUDIO_TEMPLATES = [
  {
    code: 'onboarding.welcome.named',
    version: 1,
    strategy: 'DYNAMIC',
    templateText: 'Bienvenido, {{name}}. Estamos listos para comenzar.',
    language: 'es-419',
    variables: ['name'],
    isActive: true,
  },
];

/**
 * Escenarios, **uno por worker**.
 *
 * Los dos publican catálogos independientes y sus códigos no coinciden: el
 * clasificador sirve `gasto-claro` y el de extractos `valid-basic`. El simulado
 * los tenía fundidos en una sola lista, y funcionaba sólo porque entonces los
 * dos usaban el mismo código; en cuanto dejaron de coincidir, la vista de
 * extractos recibió el catálogo del clasificador y su selector se quedó sin la
 * opción que la prueba elige. Un simulado que reparte el mismo catálogo a todo
 * el mundo no prueba el catálogo, prueba la coincidencia.
 */
export const FIXTURES = {
  'semantic-analysis': [
    {
      code: 'gasto-claro',
      name: 'Gasto de categoría clara',
      description: 'El camino feliz: debe terminar en éxito.',
      preview: 'COMPRA EN SUPERMERCADO HIPERMAXI SUCURSAL NORTE BS 487,90',
      expectsFailure: false,
    },
    {
      code: 'invalid-example',
      name: 'Entrada inválida',
      description: 'Debe rechazarse con un error controlado.',
      preview: '(texto vacío tras normalizar)',
      expectsFailure: true,
    },
  ],
  'bank-statement': [
    {
      code: 'valid-basic',
      name: 'Caso básico',
      description: 'El camino feliz: debe terminar en éxito.',
      preview: 'Extracto de una página con dos movimientos.',
      expectsFailure: false,
    },
    {
      code: 'invalid-example',
      name: 'Entrada inválida',
      description: 'Debe rechazarse con un error controlado.',
      preview: '(PDF ilegible)',
      expectsFailure: true,
    },
  ],
  'identity-verification': [
    {
      code: 'identidad-revision',
      name: 'Parecido ambiguo',
      description: 'El parecido cae entre los dos umbrales: va a una persona.',
      preview: 'Cédula legible + selfie · parecido 0,78',
      expectsFailure: false,
    },
    {
      code: 'identidad-foto-mala',
      name: 'Foto inservible',
      description: 'Se rechaza antes de llamar a ningún proveedor.',
      preview: '(documento sin foco ni contraste)',
      expectsFailure: true,
    },
  ],
  'audio-tts': [
    {
      code: 'bienvenida-con-nombre',
      name: 'Bienvenida con nombre',
      description: 'Una frase con una variable: cada nombre es un audio distinto.',
      preview: 'Bienvenido, Ana. Estamos listos para comenzar.',
      expectsFailure: false,
    },
    {
      code: 'plantilla-inexistente',
      name: 'Plantilla que no existe',
      description: 'Termina en error controlado: locutar texto libre no está permitido.',
      preview: 'onboarding.welcome.inexistente',
      expectsFailure: true,
    },
  ],
} as const;

/**
 * Un MP3 mínimo pero VÁLIDO: cabecera ID3 y relleno.
 *
 * Tiene que serlo porque el reproductor lo carga de verdad. Con bytes
 * arbitrarios el navegador rechaza el medio y la prueba mediría un reproductor
 * roto creyendo que mide uno que suena.
 */
export const AUDIO_BYTES = Buffer.concat([
  Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
  Buffer.alloc(512, 0x11),
]);

/**
 * Catálogo de categorías del semántico, con TRES niveles.
 *
 * Tres y no dos a propósito: el nivel profundo arranca cerrado en la pantalla, y
 * es el único que puede demostrar que la descarga lleva el catálogo entero y no
 * lo que estuviera desplegado. Con dos niveles, «completo» y «lo visible» serían
 * el mismo archivo y la prueba pasaría estuviera roto o no.
 */
export const SEMANTIC_CATEGORIES = [
  categoria('GASTOS', null, 1),
  categoria('GASTOS.VIVIENDA', 'GASTOS', 1),
  categoria('GASTOS.VIVIENDA.LUZ', 'GASTOS.VIVIENDA', 0.62),
  categoria('GASTOS.VIVIENDA.AGUA', 'GASTOS.VIVIENDA', 0.62),
  categoria('INGRESOS', null, 1),
  categoria('INGRESOS.SALARIO', 'INGRESOS', 0.7),
];

function categoria(code: string, parentCode: string | null, acceptanceThreshold: number) {
  return {
    code,
    name: `Nombre de ${code}`,
    description: '',
    parentCode,
    positiveExamples: [],
    counterExamples: [],
    restrictions: [],
    relatedCategoryCodes: [],
    acceptanceThreshold,
    version: 1,
    isActive: true,
  };
}
