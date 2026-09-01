import { expect, test } from '@playwright/test';
import { collectProblems } from './support/backend-mock';
import { IDENTITY_RESULT } from './support/identity-result';
import { mockWorkersBackend } from './support/workers-backend';

/**
 * La pestaña de verificación de identidad, con el ciclo de vida que avanza.
 *
 * Contra el motor simulado normal esta pantalla sólo pinta su cabecera y el
 * formulario: se estaría midiendo el encabezado creyendo medir la vista. El
 * simulado de `workers-backend.ts` progresa `QUEUED → RUNNING → terminal`, que
 * es lo que permite comprobar el seguimiento y el veredicto.
 */

const RUTA = '/workers/identity-verification';

test.describe('pestaña Verificación de Identidad', () => {
  test.setTimeout(180_000);

  test('es un worker más del grupo, junto a los dos anteriores', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });

    // Regresión de la más barata: añadir un worker no puede hacer desaparecer
    // los otros dos ni sacar la sección del cajón.
    const cajon = page.locator('.sidebar');
    await expect(cajon.getByRole('link', { name: 'Análisis semántico' })).toBeVisible();
    await expect(cajon.getByRole('link', { name: 'Extractos bancarios' })).toBeVisible();
    const propio = cajon.getByRole('link', { name: 'Identidad', exact: true });
    await expect(propio).toHaveAttribute('aria-current', 'page');

    // Y el enlace directo aterriza en ESTE worker, no en el primero de la lista.
    await expect(page.getByRole('heading', { name: 'Verificación de Identidad' })).toBeVisible();
  });

  test('el panel de control mide este worker antes de que nadie lo use', async ({ page }) => {
    await mockWorkersBackend(page);
    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Aterriza en el panel, no en el formulario: ante un servicio asíncrono la
    // primera pregunta es si está sano, no cómo mandarle trabajo.
    const panel = page.locator('.worker-dashboard');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.locator('.worker-vital-value').filter({ hasText: 'Encendido' })).toHaveCount(
      1,
    );
  });

  test('un escenario recorre el ciclo y publica el veredicto con su evidencia', async ({
    page,
  }) => {
    const problemas = collectProblems(page);
    await mockWorkersBackend(page);
    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await page.getByRole('tab', { name: 'Consola' }).click();
    const consola = page.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });

    await consola.getByRole('radio', { name: /Usar datos de prueba/i }).check();
    await consola.getByLabel('Escenario').selectOption('identidad-revision');
    await consola.getByRole('button', { name: 'Verificar' }).click();

    // El seguimiento: se comprueba el estado terminal y no los intermedios, que
    // dependen de cuántas veces haya sondeado el reloj de la vista.
    await expect(consola.getByText('Completado con advertencias')).toBeVisible({
      timeout: 60_000,
    });

    // El veredicto, con su explicación. «Requiere revisión» sin la frase se lee
    // como un fallo del worker en vez de como una abstención deliberada.
    const veredicto = consola.locator('.identity-result');
    await expect(veredicto).toBeVisible();
    await expect(veredicto.getByText('Requiere revisión')).toBeVisible();
    await expect(veredicto.getByText(/Una persona tiene que mirarlo/)).toBeVisible();

    // El motivo va en español Y con su código: la frase es de esta pantalla, el
    // código es lo que se cita en un ticket.
    await expect(veredicto.getByText('El parecido queda entre los dos umbrales')).toBeVisible();
    await expect(veredicto.locator('code', { hasText: 'AMBIGUOUS_MATCH' })).toBeVisible();

    // Los datos leídos, con el número ENMASCARADO. Si esto enseñara el número
    // entero, el enmascarado del motor no estaría llegando a la pantalla.
    await expect(veredicto.getByText('MARIA RENEE RODRIGUEZ GONZALEZ')).toBeVisible();
    await expect(veredicto.getByText('••••567')).toBeVisible();
    await expect(veredicto.getByText('1234567')).toHaveCount(0);

    /*
     * La procedencia distingue TRES cosas, no dos. Lo leído de la MRZ trae
     * dígitos de control, así que es MÁS fiable que el texto impreso: marcarlo
     * «deducido» —como hacía la primera versión— invitaba a desconfiar justo
     * del dato que se puede demostrar.
     */
    await expect(veredicto.locator('.identity-field-source.is-verified').first()).toHaveText(
      'verificado',
    );
    await expect(veredicto.getByText('deducido').first()).toBeVisible();

    // Y el encuadre: qué tuvo delante el lector, la foto entera o el recorte.
    await expect(veredicto.getByText(/Recortado del fondo/)).toBeVisible();

    // Y la evidencia de la que salió la decisión: sin ella no se puede revisar.
    await expect(veredicto.getByText('82 %').first()).toBeVisible();
    await expect(
      veredicto.locator('code', { hasText: 'sintetico-60x3-fmr1e-3-fnmr1e-2' }),
    ).toBeVisible();

    expect(problemas, `problemas de consola: ${problemas.join(' | ')}`).toEqual([]);
  });

  test('«no se pudo comparar» no se pinta como un cero', async ({ page }) => {
    /*
     * Es la distinción que el paquete original documenta y la razón de que el
     * parecido sea anulable: «no pudimos mirar» y «es otra persona» tienen
     * consecuencias opuestas para quien se verifica, y un 0 % afirmaría la
     * segunda. Se comprueba sobre la vista, que es donde alguien lo leería.
     */
    await mockWorkersBackend(page);
    /*
     * Se sirve el sobre COMPLETO en vez de encadenar sobre el simulado. Un
     * `route.fetch()` aquí saldría a la red de verdad —no al manejador de
     * debajo— y traería el HTML de la aplicación en vez de la ejecución: la
     * prueba fallaba por eso, no por la vista. El último manejador registrado
     * es el primero en atender, así que basta con responder aquí.
     */
    await page.route('**/v1/workers/identity-verification/runs/**', (route) =>
      route.fulfill({
        json: {
          requestId: 'run-identity-verification',
          status: 'SUCCEEDED_WITH_WARNINGS',
          progress: 100,
          /*
           * Un documento SUBIDO, no un escenario. Había aquí un escenario
           * `identidad-sin-comparacion` que ya no existe: con biometría real no
           * es alcanzable desde una cédula con retrato —en cuanto el detector
           * encuentra la cara, el descriptor devuelve rasgos—, así que el motor
           * dejó de anunciarlo. El estado sí ocurre con documentos reales, y es
           * la vista lo que se prueba aquí: que un parecido ausente no se pinte
           * como un cero.
           */
          inputSource: 'UPLOAD',
          fixtureCode: null,
          attemptCount: 1,
          queuedAt: '2026-08-09T10:00:00.000Z',
          startedAt: '2026-08-09T10:00:01.000Z',
          finishedAt: '2026-08-09T10:00:04.000Z',
          requestedBy: 'e2e',
          correlationId: 'corr-e2e-identidad',
          errorCode: null,
          errorMessage: null,
          result: {
            ...IDENTITY_RESULT,
            decision: 'INCONCLUSIVE',
            reasonCodes: ['FACE_MATCH_UNAVAILABLE'],
            calibratedFaceDecision: 'UNAVAILABLE',
            faceMatch: {
              similarityScore: null,
              comparable: false,
              notComparableReason: 'NO_FACE_IN_DOCUMENT',
              provider: 'human',
            },
          },
          warnings: ['FACE_MATCH_UNAVAILABLE'],
        },
      }),
    );

    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('tab', { name: 'Consola' }).click();
    const consola = page.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
    await consola.getByRole('radio', { name: /Usar datos de prueba/i }).check();
    await consola.getByLabel('Escenario').selectOption('identidad-revision');
    await consola.getByRole('button', { name: 'Verificar' }).click();

    const veredicto = consola.locator('.identity-result');
    await expect(veredicto.getByText('No concluyente')).toBeVisible({ timeout: 60_000 });
    // Acotado a la FICHA del parecido: la frase «no se pudo comparar» aparece
    // también en la explicación del veredicto y en el motivo, y un localizador
    // global casaba con las tres. Lo que aquí importa es qué cifra hay donde
    // iría el parecido.
    const parecido = veredicto.locator('.identity-evidence dd').first();
    await expect(parecido).toContainText('No se pudo comparar');
    // Y el porqué, en español. Enseñar `NO_FACE_IN_DOCUMENT` crudo justo donde
    // debería explicarse la ausencia de cifra es el defecto que esta línea
    // impide que vuelva.
    await expect(parecido).toContainText('No se encontró un rostro utilizable en el documento');
    await expect(veredicto.getByText('0 %')).toHaveCount(0);
  });

  /**
   * El desenlace que dejaba la consola colgada.
   *
   * `DOCUMENT_REJECTED` es terminal en el motor y no estaba en el vocabulario
   * de `worker-types.ts`, así que `isTerminal` lo daba por «todavía corriendo»:
   * la barra se quedaba animada en el 20 % que el motor había alcanzado antes
   * de rechazar, sin insignia, sin el motivo —que el motor ya había escrito— y
   * sin el botón de volver a empezar, sondeando cada segundo y medio una
   * ejecución cerrada. Se reportó dos veces como «el worker se cuelga».
   */
  test('un documento rechazado cierra la ejecución, la explica y deja empezar de nuevo', async ({
    page,
  }) => {
    await mockWorkersBackend(page);
    await page.route('**/v1/workers/identity-verification/runs/**', (route) =>
      route.fulfill({
        json: {
          requestId: 'run-identity-verification',
          status: 'DOCUMENT_REJECTED',
          // El progreso REAL de un rechazo: se corta en la puerta, no al final.
          progress: 20,
          inputSource: 'UPLOAD',
          fixtureCode: null,
          attemptCount: 1,
          queuedAt: '2026-08-09T10:00:00.000Z',
          startedAt: '2026-08-09T10:00:01.000Z',
          finishedAt: '2026-08-09T10:00:03.000Z',
          requestedBy: 'e2e',
          correlationId: 'corr-e2e-rechazo',
          errorCode: 'IDENTITY_DOCUMENT_NOT_IDENTITY',
          errorMessage:
            'La imagen no se reconoce como un documento de identidad. Envía una foto de tu carnet, completo y enfocado.',
        },
      }),
    );

    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('tab', { name: 'Consola' }).click();
    const consola = page.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
    await consola.getByRole('radio', { name: /Usar datos de prueba/i }).check();
    await consola.getByLabel('Escenario').selectOption('identidad-revision');
    await consola.getByRole('button', { name: 'Verificar' }).click();

    const seguimiento = consola.locator('.worker-run');
    await expect(seguimiento.getByText('Documento rechazado')).toBeVisible({ timeout: 60_000 });
    // El motivo que el motor escribió, a la vista de quien subió la foto.
    await expect(seguimiento.locator('.worker-rejected-message')).toContainText(
      'Envía una foto de tu carnet',
    );
    // Y la salida: sin este botón hay que recargar la página para reintentar.
    await expect(seguimiento.getByRole('button', { name: 'Nueva ejecución' })).toBeVisible();
    // La barra ya no se anuncia como viva. Es lo que se veía «colgado».
    await expect(seguimiento.locator('.worker-progress-fill.is-running')).toHaveCount(0);
  });
});
