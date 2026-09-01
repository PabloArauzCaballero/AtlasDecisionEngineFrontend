import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  EVIDENCIA,
  capturar,
  panelDeIdentidad,
  panelDeWorker,
  vigilar,
} from './support/identidad-real';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';

/**
 * La VERIFICACION DE IDENTIDAD de punta a punta, contra el motor real.
 *
 * Se entra por la pantalla de acceso con un usuario del proveedor de identidad
 * -rol `RISK_ANALYST`, el minimo que el worker exige- y se recorre el camino
 * completo: pestana, escenario, encolado, procesado por el worker de fondo y
 * veredicto pintado. Un simulado prueba que la vista sabe dibujar la forma que
 * este repositorio CREE que el motor sirve; esto prueba que esa creencia es
 * cierta.
 *
 * Deja capturas en `docs/visual-evidence/identidad/`, que es la evidencia de la
 * integracion. **No afirma nada sobre ellas**: revisarlas es trabajo de una
 * persona, y es justo lo que una herramienta de evidencia no puede prometer.
 *
 * Sin `PW_USER`/`PW_PASSWORD` se salta entera: correr contra un motor real es
 * opt-in, y una prueba roja por falta de configuracion no informa de ningun
 * defecto. Las credenciales **nunca se escriben en el repositorio**.
 *
 *   PW_BASE_URL=http://localhost:5180 PW_TENANT_ID=1  *     PW_USER=<correo> PW_PASSWORD=<clave>  *     yarn playwright test e2e/portal-real-identidad.spec.ts
 */

test.describe.configure({ mode: 'serial' });

test.describe('verificación de identidad · motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  test.beforeAll(() => {
    mkdirSync(EVIDENCIA, { recursive: true });
  });

  /**
   * El acceso con una cuenta REAL cuyo segundo factor llega a un buzón externo.
   *
   * Se salta salvo que se pida con `PW_PIN_FILE`, y por un motivo concreto:
   * espera a que una persona escriba el código en ese archivo, y una prueba que
   * se queda parada esperando a alguien no puede formar parte de la corrida
   * normal.
   *
   * El tope es largo por lo mismo. Cada intento de acceso emite un PIN NUEVO e
   * invalida el anterior —comprobado: el portal responde «el código no es
   * válido; los códigos sirven una sola vez»—, así que no vale pasarlo por
   * adelantado: hay que esperar al que corresponde a esta sesión.
   *
   *   PW_PIN_FILE=/tmp/pin.txt yarn playwright test e2e/portal-real-identidad.spec.ts \
   *     --grep "cuenta real"
   *   # cuando llegue el correo:  echo 123456 > /tmp/pin.txt
   */
  test('la cuenta real entra y el portal le monta su marco', async ({ page }) => {
    test.skip(!process.env.PW_PIN_FILE, 'Opt-in: define PW_PIN_FILE para entrar con PIN a mano.');
    test.setTimeout(25 * 60_000);

    await entrar(page);
    await expect(page.locator('.sidebar')).toBeVisible();

    /*
     * Lo que esta cuenta VE, que es donde se nota el reparto de roles: el menú
     * se construye con los roles efectivos de la sesión. Comprobar que hay
     * entradas —y no cuáles— es lo honesto aquí: cuáles depende del rol que
     * tenga la cuenta, y fijarlo convertiría esta prueba en un inventario.
     */
    const entradas = page.locator('.sidebar a');
    await expect(entradas.first()).toBeVisible();
    expect(await entradas.count()).toBeGreaterThan(0);

    // Y que el worker nuevo carga para ella: es lo que se quería comprobar.
    await page.goto('/workers/identity-verification', { waitUntil: 'domcontentloaded' });
    await expect(panelDeIdentidad(page).locator('.worker-dashboard')).toBeVisible({
      timeout: 60_000,
    });
    await capturar(page, '20-cuenta-real');
  });

  test('login real, pestaña nueva, ejecución y veredicto', async ({ page }) => {
    // El worker de fondo remuestrea tres imágenes por ejecución: el minuto largo
    // es el coste real del trabajo, no una holgura por si acaso.
    test.setTimeout(6 * 60_000);
    const { consola, red, sesion401 } = vigilar(page);

    // --- 1. Acceso ---------------------------------------------------------
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await capturar(page, '01-login');
    await entrar(page);
    await capturar(page, '02-sesion-iniciada');

    // --- 2. El grupo de workers del cajón, con los tres -----------------------
    await page.goto('/workers', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const cajon = page.locator('.sidebar');
    await expect(cajon.getByRole('link', { name: 'Análisis semántico' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(cajon.getByRole('link', { name: 'Extractos bancarios' })).toBeVisible();
    const enlace = cajon.getByRole('link', { name: 'Identidad', exact: true });
    await expect(enlace).toBeVisible();
    await capturar(page, '03-workers');

    // --- 3. El worker nuevo -------------------------------------------------
    await enlace.click();
    await expect(page.getByRole('heading', { name: 'Verificación de Identidad' })).toBeVisible();
    const mio = panelDeIdentidad(page);
    await expect(mio.locator('.worker-dashboard')).toBeVisible({ timeout: 60_000 });
    await capturar(page, '04-pestana-identidad');

    // --- 4. La consola ------------------------------------------------------
    await mio.getByRole('tab', { name: 'Consola' }).click();
    const consolaVista = mio.locator('.worker-console');
    await expect(consolaVista.locator('.worker-input')).toBeVisible({ timeout: 60_000 });

    const hechos = consolaVista.locator('.worker-facts');
    await expect(hechos).not.toHaveClass(/is-loading/, { timeout: 60_000 });
    test.skip(
      /Apagado en este entorno/i.test(await hechos.innerText()),
      'Worker de identidad apagado en este motor.',
    );

    await consolaVista.getByRole('radio', { name: /Usar datos de prueba/i }).check();
    await consolaVista.getByLabel('Escenario').selectOption({ label: 'Verificación limpia' });
    await capturar(page, '05-entrada');

    // --- 5. Ejecución -------------------------------------------------------
    await consolaVista.getByRole('button', { name: 'Verificar' }).click();
    // La ejecución aparece en cuanto el motor la acepta: es el 202 pintado.
    await expect(consolaVista.locator('.worker-run')).toBeVisible({ timeout: 60_000 });
    await capturar(page, '06-procesando');

    // --- 6. Veredicto -------------------------------------------------------
    const veredicto = consolaVista.locator('.identity-result');
    await expect(veredicto).toBeVisible({ timeout: 4 * 60_000 });

    // Se afirma el RESULTADO, no que se llamara a nadie. El escenario limpio
    // promete «verificado» en su descripción, y esa descripción se le enseña al
    // usuario antes de ejecutarlo: si no lo cumple, la promesa es falsa.
    await expect(veredicto.getByText('Verificado', { exact: true })).toBeVisible();

    // El analizador de cédula boliviana leyó de verdad. Sin esto, la prueba
    // pasaría igual con un motor que devolviera campos vacíos.
    await expect(veredicto.getByText('MARIA RENEE RODRIGUEZ GONZALEZ')).toBeVisible();
    await expect(veredicto.getByText('2028-11-01')).toBeVisible();

    /*
     * Y la fecha de nacimiento sale de la MRZ del reverso, no del anverso: es
     * la única parte del documento con dígitos de control, así que la vista la
     * marca «verificado» en vez de «deducido». Que esto se vea es lo que separa
     * un dato que se puede demostrar de uno en el que hay que confiar.
     */
    await expect(veredicto.getByText('2003-04-05')).toBeVisible();
    await expect(veredicto.locator('.identity-field-source.is-verified').first()).toBeVisible();

    /*
     * El número de documento llega enmascarado desde el motor. Se busca dentro
     * de su ficha y no con un texto exacto: la celda lleva ahora también la
     * insignia de procedencia, así que anclar la expresión al principio y al
     * final del nodo dejó de casar en cuanto el número pasó a venir de la MRZ.
     */
    await expect(
      veredicto
        .locator('.identity-fields dd')
        .filter({ hasText: /•{3,}\d{3}/ })
        .first(),
    ).toBeVisible();
    await expect(veredicto.getByText('1234567')).toHaveCount(0);

    // Y la evidencia: sin ella un «verificado» no se puede auditar después.
    await expect(veredicto.locator('.identity-evidence')).toBeVisible();
    await expect(veredicto.getByText(/Decidido con/)).toBeVisible();
    await capturar(page, '07-veredicto');
    // Y el veredicto solo, recortado: es lo que hay que revisar de verdad, y en
    // la captura de página entera queda al final de un lienzo de 1800 px.
    await veredicto.screenshot({ path: `${EVIDENCIA}/07b-veredicto-detalle.png` });

    // --- 7. Consola y red ---------------------------------------------------
    expect(consola, `errores de consola: ${consola.join(' | ')}`).toEqual([]);
    expect(red, `respuestas con error: ${red.join(' | ')}`).toEqual([]);
    // Los 401 que hubo, sólo del refresco de credencial. Uno en una ruta de
    // worker significaría que el rol no alcanza y la vista lo estaría
    // escondiendo.
    expect(
      sesion401.filter((url) => !url.includes('/v1/session/')),
      `401 fuera del refresco de sesión: ${sesion401.join(' | ')}`,
    ).toEqual([]);
  });

  test('los workers anteriores siguen funcionando', async ({ page }) => {
    /*
     * Regresión, y no una comprobación de cortesía: los tres workers comparten
     * catálogo, mapeador de ejecuciones y servicio de métricas, así que un
     * cambio en cualquiera de esas piezas los rompe a la vez. Se ejercita el de
     * extractos entero —encolar, procesar, resultado— porque es el que no
     * depende de ningún servicio externo.
     */
    test.setTimeout(6 * 60_000);
    await entrar(page);
    await page.goto('/workers/bank-statement', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const suyo = panelDeWorker(page, 'bank-statement');
    await suyo.getByRole('tab', { name: 'Consola' }).click();
    const consola = suyo.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 60_000 });
    await consola.getByRole('radio', { name: /Usar datos de prueba/i }).check();
    // Por su NOMBRE del catálogo del motor, no por su posición: reordenar los
    // escenarios no debe cambiar en silencio lo que esta regresión mide.
    await consola.getByLabel('Escenario').selectOption({ label: 'Extracto mínimo' });
    await consola.getByRole('button', { name: 'Convertir' }).click();

    await expect(suyo.locator('.worker-table-scroll table')).toBeVisible({ timeout: 4 * 60_000 });
    await expect(suyo.locator('.worker-table-scroll tbody tr')).not.toHaveCount(0);
    await capturar(page, '08-regresion-extractos');
  });

  test('en un móvil no aparece desplazamiento horizontal', async ({ page }) => {
    /*
     * Las tres imágenes van en una rejilla `auto-fit`: en escritorio caben una
     * al lado de otra y en un móvil se apilan. Lo que se comprueba aquí es lo
     * único que una captura no dice sola —que NADA sobresale del ancho—, porque
     * un desplazamiento horizontal en el cuerpo esconde controles sin avisar.
     */
    test.setTimeout(3 * 60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page);
    await page.goto('/workers/identity-verification', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const mio = panelDeIdentidad(page);
    await mio.getByRole('tab', { name: 'Consola' }).click();
    const consola = mio.locator('.worker-console');
    await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 60_000 });
    await consola.getByRole('radio', { name: /Cargar mis propias imágenes/i }).check();
    await expect(consola.locator('.identity-image-picker')).toHaveCount(3);

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde, 'el cuerpo se desplaza en horizontal').toBeLessThanOrEqual(1);
    await capturar(page, '12-movil');
  });

  test('el panel de control del worker nuevo mide sus ejecuciones', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    await entrar(page);
    await page.goto('/workers/identity-verification', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const panel = panelDeIdentidad(page).locator('.worker-dashboard');
    await expect(panel).toBeVisible({ timeout: 60_000 });
    // Las cifras las calcula el motor sobre la ventana entera, no esta vista
    // sobre una página de ejecuciones. Que haya alguna es lo que demuestra que
    // el worker nuevo está dado de alta también en las métricas.
    await expect(panel.locator('.worker-vital-value').first()).toBeVisible();
    await capturar(page, '09-panel-identidad');
  });
});
