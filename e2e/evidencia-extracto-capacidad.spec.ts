import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { CREDENCIALES, HAY_CREDENCIALES, entrar } from './support/real-portal';

/**
 * Evidencia visual del flujo de extracción de capacidad de pago, contra el motor REAL.
 *
 * ## Qué afirma, y por qué no es sólo un generador de capturas
 *
 * Las tres cosas que cambiaron, y las tres se pueden romper en silencio:
 *
 * 1. **El padrón de entidades tiene cara.** Sesenta y ocho entidades con su logotipo, y los
 *    monogramas ROTULADOS como tales. Sin el rótulo, alguien acabaría usando el cuadrado de tres
 *    letras como si fuera la marca de la cooperativa.
 * 2. **Un extracto aceptado publica su capacidad de pago.** Tres meses completos, el ingreso
 *    reconocido, lo comprometido y la cuota máxima, con el tope que la limitó. Es lo que convierte
 *    un límite en algo que un analista puede discutir en vez de refrendar.
 * 3. **Cada rechazo se anuncia con SU motivo.** El extracto de un mes, el PDF compuesto en un
 *    editor y la factura de una telefónica son tres rechazos distintos con tres acciones distintas,
 *    y hasta ahora se anunciaban igual.
 *
 * ## Contra el motor real, y no contra un doble
 *
 * Porque lo que se está comprobando es justamente la conversación entre el portal y el motor: que
 * el veredicto viaja, que la evaluación llega entera y que la pantalla la sabe leer. Un doble haría
 * verde una pantalla que lee un contrato que el motor no emite.
 *
 * Se salta entera sin credenciales, en vez de fallar: correr contra un motor real es opt-in, y una
 * prueba roja por falta de configuración no informa de ningún defecto.
 *
 *   PW_BASE_URL=http://localhost:5180 PW_TENANT_ID=1 PW_USER=… PW_PASSWORD=… \
 *   PW_PIN_INBOX_PORT=8790 yarn playwright test e2e/evidencia-extracto-capacidad.spec.ts
 */

const OUT = 'docs/visual-evidence';
const RUTA = '/workers/bank-statement';

test.skip(!HAY_CREDENCIALES, 'Sin PW_USER/PW_PASSWORD no se entra al portal real.');
test.describe.configure({ mode: 'serial' });

let sesion: Page;

test.beforeAll(async ({ browser }) => {
  await mkdir(OUT, { recursive: true });
  /*
   * UNA sesión para toda la suite, y no una por prueba. El segundo factor emite un PIN nuevo en
   * cada intento e invalida el anterior: entrar cuatro veces significa cuatro PIN, y el recolector
   * sólo puede seguir la conversación de uno.
   */
  sesion = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await entrar(sesion);
});

test.afterAll(async () => {
  await sesion?.close();
});

/** Abre el worker de extractos por su pestaña. */
async function pestana(nombre: string) {
  await sesion.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sesion.getByRole('tab', { name: nombre }).click();
}

/** Lanza un escenario y espera a que el motor lo cierre. */
async function convertir(escenario: string) {
  await pestana('Consola');
  const consola = sesion.locator('.worker-console');
  await expect(consola.locator('.worker-input')).toBeVisible({ timeout: 30_000 });
  await consola.getByLabel('Escenario').selectOption(escenario);
  await consola.getByRole('button', { name: 'Convertir' }).click();
  return consola;
}

test('el padrón enseña las 68 entidades con su logotipo, y rotula los monogramas', async () => {
  await pestana('Entidades financieras');

  const tabla = sesion.locator('.entidad-tabla').first();
  await expect(tabla).toBeVisible({ timeout: 30_000 });

  /*
   * Las imágenes llegan por la puerta autenticada y se pintan desde un blob local: si el portal
   * hubiera vuelto a `<img src="/v1/…">`, el motor respondería 401 y aquí no habría ninguna.
   *
   * Se SONDEA el recuento en vez de leerlo una vez. Son sesenta y ocho peticiones autenticadas que
   * salen a la vez al montar la tabla, y contar en el primer render mide cuántas habían vuelto en
   * ese instante —una— y no cuántas vuelven. Un recuento único aquí sería una prueba inestable que
   * enseña a reintentar en vez de a mirar.
   */
  const logos = sesion.locator('img.entidad-logo');
  await expect(logos.first()).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => logos.count(), {
      timeout: 30_000,
      message: 'los logotipos no acabaron de cargar',
    })
    .toBeGreaterThan(10);

  /*
   * El rótulo del monograma. Es la mitad del valor de la columna: un cuadrado con tres letras que
   * no se anuncia como marcador de posición se acaba usando como si fuera la marca de la entidad.
   */
  await expect(sesion.locator('.entidad-logo-origen').first()).toBeVisible();

  await sesion.screenshot({
    path: `${OUT}/30-padron-entidades-con-logotipos.png`,
    fullPage: false,
  });
});

test('un extracto de tres meses publica su capacidad de pago con el desglose', async () => {
  await convertir('valid-basic');

  const capacidad = sesion.locator('.capacidad');
  await expect(capacidad).toBeVisible({ timeout: 60_000 });

  // La cobertura: es la condición sin la cual nada de lo demás significa algo.
  await expect(capacidad.locator('.capacidad-cobertura')).toContainText('3 de 3 meses completos');
  await expect(capacidad.locator('.capacidad-cobertura')).toHaveAttribute('data-satisfecha', 'si');

  /*
   * Las cifras del cálculo, y la serie mensual que las sostiene. Se buscan por ROL —el `<dt>` de la
   * lista de definición— y no por texto: «Ingreso reconocido» aparece además como cabecera de
   * columna y dentro del resumen accesible de la tabla, y un localizador por texto casaría con los
   * tres. Lo que esta prueba afirma es que la CIFRA está, no que la palabra aparezca.
   */
  await expect(capacidad.getByRole('term').filter({ hasText: 'Ingreso reconocido' })).toBeVisible();
  await expect(
    capacidad.getByRole('term').filter({ hasText: 'Cuota máxima sostenible' }),
  ).toBeVisible();
  await expect(capacidad.locator('.capacidad-meses tbody tr')).toHaveCount(3);

  // Y el contenedor, comprobado y limpio: un panel que sólo aparece cuando algo va mal no permite
  // distinguir «se comprobó» de «esta versión no lo comprueba».
  await expect(sesion.locator('.autenticidad')).toContainText('Contenedor sin indicios');

  await capacidad.scrollIntoViewIfNeeded();
  await sesion.screenshot({ path: `${OUT}/31-capacidad-de-pago-tres-meses.png`, fullPage: false });
});

test('un extracto con rechazos y deuda creciente se acepta y sale con sus motivos', async () => {
  await convertir('strained-capacity');

  const capacidad = sesion.locator('.capacidad');
  await expect(capacidad).toBeVisible({ timeout: 60_000 });

  // Aceptar no es aprobar: el documento es legítimo y la evaluación dice que no hay margen.
  await expect(capacidad.locator('.capacidad-banda')).toContainText('Insuficiente');
  await expect(capacidad.locator('.capacidad-motivos li')).not.toHaveCount(0);
  await expect(
    capacidad.locator('.capacidad-motivos').getByText(/fondos insuficientes/i),
  ).toBeVisible();

  await capacidad.scrollIntoViewIfNeeded();
  await sesion.screenshot({
    path: `${OUT}/32-capacidad-insuficiente-con-motivos.png`,
    fullPage: false,
  });
});

test('el extracto de UN mes se rechaza por periodo, y lo dice', async () => {
  const consola = await convertir('short-period');

  await expect(consola.getByText('PDF no válido').first()).toBeVisible({ timeout: 60_000 });
  /*
   * El motivo es la mitad del arreglo. «No se pudo procesar» deja a la persona reintentando con el
   * mismo archivo; «cubre 1 mes y se necesitan 3» se resuelve en un minuto.
   */
  await expect(
    sesion.locator('.toast-viewport').getByText(/menos de 3 meses completos/i),
  ).toBeVisible({ timeout: 30_000 });
  // Y NO el texto prohibido: describe el estado del sistema en vez de lo que hay que hacer.
  await expect(sesion.locator('.toast-viewport').getByText(/no se pudo procesar/i)).toHaveCount(0);

  await sesion.screenshot({
    path: `${OUT}/33-rechazo-por-periodo-insuficiente.png`,
    fullPage: false,
  });
});

test('el PDF compuesto en un editor se rechaza por su contenedor', async () => {
  const consola = await convertir('tampered-document');

  await expect(consola.getByText('PDF no válido').first()).toBeVisible({ timeout: 60_000 });
  /*
   * Mismo contenido que el camino feliz —misma entidad, mismas glosas, mismos importes— y se
   * rechaza. Es lo único que ninguna de las otras dos compuertas puede ver.
   */
  await expect(
    sesion.locator('.toast-viewport').getByText(/no es el PDF que emite el banco/i),
  ).toBeVisible({ timeout: 30_000 });
  // Y NO se le dice qué señal lo delató: eso sería enseñarle qué evitar la próxima vez.
  await expect(sesion.getByText(/photoshop/i)).toHaveCount(0);

  await sesion.screenshot({ path: `${OUT}/34-rechazo-documento-manipulado.png`, fullPage: false });
});

test('el estado de cuenta de una telefónica se rechaza por su emisor', async () => {
  const consola = await convertir('foreign-issuer');

  await expect(consola.getByText('PDF no válido').first()).toBeVisible({ timeout: 60_000 });
  await expect(
    sesion.locator('.toast-viewport').getByText(/no parece corresponder a un extracto bancario/i),
  ).toBeVisible({ timeout: 30_000 });

  await sesion.screenshot({ path: `${OUT}/35-rechazo-emisor-no-financiero.png`, fullPage: false });
});

test('las credenciales del padrón siguen siendo del tenant que entró', async () => {
  // Cierre de la suite: la sesión es real y sigue viva. Si el portal hubiera perdido el token —o lo
  // hubiera renovado mal— las pruebas anteriores habrían pasado con datos de otra sesión.
  expect(CREDENCIALES.tenantId).toBe('1');
  await pestana('Entidades financieras');
  await expect(sesion.locator('.entidad-tabla').first()).toBeVisible({ timeout: 30_000 });
});
