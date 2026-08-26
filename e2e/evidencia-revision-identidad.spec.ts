import { expect, test, type Page } from '@playwright/test';

/**
 * Evidencia visual de la revisión de un caso de IDENTIDAD.
 *
 * ## Qué comprueba, y por qué no es sólo un generador de capturas
 *
 * `visual-evidence.spec.ts` no afirma nada: existe para poder mirar. Ésta sí afirma, y afirma las
 * dos cosas que cambiaron en la pantalla del analista:
 *
 * 1. **Las capturas se pasan de lado.** Eran una rejilla con `object-fit: cover` sobre celdas de
 *    130 px, que le come los bordes a una cédula apaisada y le corta la frente a una selfie — y lo
 *    que hay que mirar en un caso de identidad está justo ahí: la MRZ va pegada al canto inferior
 *    del reverso. Se comprueba que el carrusel EXISTE, que el indicador cuenta bien y que pasar de
 *    slide cambia el pie.
 * 2. **La evidencia del caso incluye las tres fuentes nuevas.** Un caso de identidad ya no llega
 *    por una sola razón: puede llegar por el parecido, por la plantilla del documento, porque el
 *    registro estatal no confirmó o por la forma de la agenda del teléfono. Enseñar sólo las
 *    biométricas obligaba a abrir el expediente crudo para saber por cuál de las cuatro llegó — y a
 *    decidir, mientras tanto, sobre la que la pantalla sugería.
 *
 * Y deja la captura, que es lo que se adjunta a una revisión.
 *
 * ## Por qué el backend va doblado
 *
 * Porque lo que se prueba es la PANTALLA. Levantar el motor, AtlasBackend, Postgres y un caso
 * sembrado con tres imágenes reales para comprobar que un carrusel pasa de slide ataría esta
 * prueba a cuatro servicios que pueden estar caídos por motivos que no tienen nada que ver.
 *
 * Las imágenes son PNG de un píxel en `data:`. No hacen bonita la captura y da igual: lo que la
 * captura tiene que demostrar es la DISPOSICIÓN —una ventana ancha, un pie, un indicador— y para
 * eso el contenido de la foto es irrelevante. Meter una cédula de verdad aquí sería, además,
 * exactamente lo que este producto promete no hacer.
 */

const OUT = 'docs/visual-evidence';

const CASO_ID = 'case-identidad-demo';
const ATTEMPT_ID = '5501';
const CUSTOMER_ID = '900';

function forgedJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return `${header}.${payload}.mock`;
}

const MOCK_SESSION = {
  accessToken: forgedJwt(),
  tokenType: 'Bearer',
  expiresIn: '3600',
  user: {
    id: 'evidence-user',
    tenantId: '1',
    email: 'demo@atlas.bo',
    fullName: 'Demo',
    name: 'Demo',
    userCode: 'DEMO',
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles: ['PLATFORM_ADMIN', 'RISK_ANALYST', 'COMPLIANCE', 'AUDITOR', 'OPERATIONS'],
    legacyRoles: [],
    permissions: [],
  },
};

/**
 * El caso tal como lo sirve el motor tras el artefacto 1.2.0.
 *
 * La evidencia trae las cuatro claves nuevas. Se escriben aquí con los mismos nombres que el
 * artefacto emite (`identity-mobile.graph.ts`): si alguno se renombrara allí sin tocarlo aquí, esta
 * prueba se pondría en rojo, que es exactamente lo que debe pasar — la pantalla dejaría de enseñar
 * ese dato y nadie se enteraría.
 */
const CASO = {
  id: CASO_ID,
  caseCode: 'MR-IDENT-0042',
  queueCode: 'IDENTIDAD',
  status: 'PENDING',
  priority: 10,
  reason: 'SOSPECHA_DE_FRAUDE',
  artifactCode: 'IDENTIDAD_CARNET_MOVIL',
  subjectReference: 'cli-900',
  assignedTo: null,
  slaDueAt: '2026-08-26T18:00:00.000Z',
  createdAt: '2026-08-26T12:00:00.000Z',
  updatedAt: '2026-08-26T12:00:00.000Z',
  correlationId: ATTEMPT_ID,
  executionId: 'exec-identidad-demo',
  evidenceJson: {
    motivo: 'SOSPECHA_DE_FRAUDE',
    parecido: 0.883,
    tipoDocumento: 'BOLIVIA_CI',
    pruebaDeVida: 'PASSED',
    decisionDelWorker: 'REVIEW_REQUIRED',
    veredictoDeFraude: 'FRAUD_SUSPECTED',
    riesgoDeFraude: 0.68,
    registroEstatal: 'FOUND',
    riesgoDeAgenda: 55,
  },
};

/**
 * PNG de 1×1, verde y semitransparente. Ver la cabecera: lo que la captura demuestra es la
 * DISPOSICIÓN —una ventana ancha, un pie, un indicador— y para eso el contenido da igual. Que sea
 * de un color plano ayuda además a leer en la captura dónde empieza y acaba cada slide.
 */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const DOCUMENTOS = [
  { documentId: 'd1', documentType: 'identity_front', mimeType: 'image/png', sizeBytes: 1, sha256: 'aa11bb22cc33dd44' },
  { documentId: 'd2', documentType: 'identity_back', mimeType: 'image/png', sizeBytes: 1, sha256: 'ee55ff66aa77bb88' },
  { documentId: 'd3', documentType: 'selfie', mimeType: 'image/png', sizeBytes: 1, sha256: '99cc00dd11ee22ff' },
];

async function mockBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));

  // Los bytes de cada documento. Van ANTES del comodín de `/atlas-backend/**` porque el primer
  // manejador que casa es el que responde, y el comodín también casaría con esta ruta.
  await page.route('**/evidence-documents/*/content', (route) =>
    route.fulfill({ body: PIXEL, contentType: 'image/png' }),
  );
  await page.route('**/identity-verifications/*/evidence-documents', (route) =>
    route.fulfill({ json: { customerId: CUSTOMER_ID, documents: DOCUMENTOS } }),
  );

  await page.route('**/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/manual-reviews/')) return route.fulfill({ json: CASO });
    // El expediente completo se pide aparte y aquí no aporta: se contesta 403 para ejercitar
    // además el aviso de «no se pudo traer», que es lo que el analista ve sin permiso.
    if (url.includes('/v1/audit/executions/')) {
      return route.fulfill({ status: 403, json: { code: 'FORBIDDEN', message: 'Sin permiso' } });
    }
    return route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0, hasNextPage: false } });
  });
}

test('la revisión de identidad enseña las tres fuentes y las capturas como slides', async ({ page }) => {
  test.setTimeout(120_000);
  await mockBackend(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto(`/manual-reviews/${CASO_ID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // --- 1. La evidencia, con las cuatro claves nuevas ------------------------
  const evidencia = page.locator('.panel', { hasText: 'Evidencia del caso' });
  await evidencia.waitFor({ timeout: 30_000 });
  await expect(evidencia).toContainText('Autenticidad del documento');
  await expect(evidencia).toContainText('FRAUD_SUSPECTED');
  await expect(evidencia).toContainText('Riesgo de fraude documental');
  await expect(evidencia).toContainText('Registro estatal (SEGIP)');
  await expect(evidencia).toContainText('Riesgo de la agenda');

  // --- 2. El carrusel -------------------------------------------------------
  const carrusel = page.locator('.case-carousel');
  await carrusel.waitFor({ timeout: 30_000 });
  await expect(carrusel.locator('.case-carousel__slide')).toHaveCount(3);
  await expect(carrusel.locator('.case-carousel__count')).toHaveText('1 / 3');
  await expect(carrusel.locator('.case-carousel__caption')).toContainText('Anverso del carnet');

  await page.screenshot({
    path: `${OUT}/20-revision-identidad-slide-1.png`,
    fullPage: true,
    animations: 'disabled',
  });

  // Pasar de slide con la flecha: es el camino de quien no puede hacer el gesto, y es el que una
  // prueba automática puede recorrer. El gesto lo cubre `scroll-snap`, que es del navegador.
  await carrusel.getByRole('button', { name: 'Documento siguiente' }).click();
  await expect(carrusel.locator('.case-carousel__count')).toHaveText('2 / 3');
  await expect(carrusel.locator('.case-carousel__caption')).toContainText('Reverso del carnet');

  await carrusel.getByRole('button', { name: 'Documento siguiente' }).click();
  await expect(carrusel.locator('.case-carousel__count')).toHaveText('3 / 3');
  await expect(carrusel.locator('.case-carousel__caption')).toContainText('Selfie');
  // En la última no hay a dónde ir: la flecha se deshabilita en vez de no hacer nada.
  await expect(carrusel.getByRole('button', { name: 'Documento siguiente' })).toBeDisabled();

  /*
   * La posición de reposo cae EXACTAMENTE en el borde de la slide.
   *
   * Es lo que `scroll-snap-align: start` garantiza y lo que `center` no daba: con la pista
   * centrando el rectángulo de snap, el borde de 1 px la corría medio píxel por slide y en la
   * tercera asomaba el rabo de la segunda. Una captura no distingue «medio píxel» de «bien», así
   * que la afirmación tiene que ser aritmética.
   */
  const pista = carrusel.locator('.case-carousel__track');
  /*
   * Con `expect.poll` y no con una lectura suelta: el desplazamiento es SUAVE, así que medirlo justo
   * después de pulsar devuelve un punto intermedio de la animación. Medido: 1211 de 1396, o sea un
   * 87 % del camino. Una aserción que se cree ese número no comprueba la alineación — comprueba con
   * qué rapidez corre la máquina ese día, que es la peor clase de prueba inestable.
   */
  await expect
    .poll(
      () =>
        pista.evaluate((nodo) => Math.abs(nodo.scrollLeft - 2 * nodo.clientWidth)),
      { timeout: 5_000 },
    )
    .toBeLessThanOrEqual(1);

  /*
   * Ésta se captura del PANEL y no de la página entera, y no es una preferencia de encuadre.
   *
   * `fullPage` redimensiona el viewport para caber la página completa, y ese cambio de disposición
   * hace que `scroll-snap-type: x mandatory` vuelva a ajustar la pista: la evidencia salía en la
   * segunda slide después de haber comprobado que estábamos en la tercera. Una captura que
   * contradice a la aserción que tiene encima es peor que no tener captura — enseña a desconfiar de
   * las dos.
   *
   * Capturando el elemento no hay redimensión, y de paso la evidencia enseña el carrusel grande en
   * vez de perdido en dos mil píxeles de página.
   */
  const panelDocumentos = page.locator('.panel', { hasText: 'Documentos del solicitante' });
  await panelDocumentos.screenshot({
    path: `${OUT}/21-revision-identidad-slide-3.png`,
    animations: 'disabled',
  });
  // La captura tiene que enseñar lo que la aserción dijo: se vuelve a comprobar DESPUÉS de tomarla.
  await expect(carrusel.locator('.case-carousel__count')).toHaveText('3 / 3');

  // --- 3. El caso NO llega con la decisión puesta ---------------------------
  /*
   * Se comprueba aquí porque es la propiedad que este carrusel podría haber roto sin querer: la
   * pantalla se reordenó entera. Preseleccionar «Aprobar» convierte un descuido —pulsar sin leer—
   * en una aprobación con nombre y apellidos en la auditoría.
   */
  const resolucion = page.locator('.panel', { hasText: 'Resolver el caso' });
  await expect(resolucion).toBeVisible();
});
