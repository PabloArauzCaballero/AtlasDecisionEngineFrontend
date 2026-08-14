import { readFile, rm } from 'node:fs/promises';
import { expect, type Locator, type Page } from '@playwright/test';
import { BuzonPin, HAY_BUZON, PUERTO_BUZON } from './buzon-pin';

/**
 * Andamiaje del barrido del portal contra el motor REAL.
 *
 * Se entra por la pantalla de acceso con un usuario del proveedor de identidad,
 * no con una sesión forjada. La diferencia importa: la sesión forjada salta el
 * login, el refresco de token y el reparto de roles, que es justo el tramo donde
 * un portal falla de formas que ninguna otra prueba ve.
 *
 * Las credenciales llegan por entorno y **nunca se escriben en el repositorio**:
 *
 *   PW_TENANT_ID=1 PW_USER=<correo> PW_PASSWORD=<clave> PW_BASE_URL=http://localhost:5180 \
 *     yarn playwright test e2e/portal-real.spec.ts
 *
 * Sin ellas la suite se salta entera en vez de fallar: correr contra un motor
 * real es opt-in, y una prueba roja por falta de configuración no informa de
 * ningún defecto.
 */

export const CREDENCIALES = {
  tenantId: process.env.PW_TENANT_ID ?? '1',
  email: process.env.PW_USER ?? '',
  password: process.env.PW_PASSWORD ?? '',
};

export const HAY_CREDENCIALES = CREDENCIALES.email !== '' && CREDENCIALES.password !== '';

/**
 * Entra por la pantalla de acceso, como una persona.
 *
 * Espera al marco del portal y no a una URL: `router.replace` cambia la barra de
 * direcciones antes de que el marco exista, y comprobar la URL daba por buena
 * una sesión que todavía no había pintado nada.
 *
 * Si el proveedor de identidad exige segundo factor, la contraseña sólo abre la
 * pantalla del PIN, y este andamiaje lo completa leyendo el correo del
 * recolector (`buzon-pin.ts`). **No apaga el segundo factor**: apagarlo dejaría
 * la corrida en verde sin haber probado el camino de acceso real.
 */
export async function entrar(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const buzon = await abrirBuzon();
  try {
    await campoTenant(page).fill(CREDENCIALES.tenantId);
    await campoCorreo(page).fill(CREDENCIALES.email);
    await campoClave(page).fill(CREDENCIALES.password);
    await botonEntrar(page).click();

    await completarSegundoFactor(page, buzon);
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 60_000 });
  } finally {
    await buzon?.cerrar();
  }
}

async function abrirBuzon(): Promise<BuzonPin | null> {
  if (!HAY_BUZON) return null;
  const buzon = new BuzonPin();
  await buzon.abrir(PUERTO_BUZON);
  return buzon;
}

/**
 * El PIN se pide sólo si aparece su pantalla. La espera es corta a propósito: si el despliegue no
 * exige segundo factor, la barra lateral ya está montada y esperar un campo que no va a existir
 * sólo alargaría cada prueba.
 */
async function completarSegundoFactor(page: Page, buzon: BuzonPin | null): Promise<void> {
  const campo = campoPin(page);
  /*
   * `waitFor` y no `isVisible`: `isVisible()` NO espera —comprueba y devuelve al
   * instante, y su opción `timeout` sólo acota esa comprobación—. La pantalla
   * del PIN aparece un momento después de que el acceso responda, así que
   * siempre daba `false`: la guarda no saltaba, y el fallo salía 60 s más tarde
   * como «no aparece la barra lateral», que apunta al portal cuando lo que pasó
   * fue que el proveedor de identidad pidió un segundo factor. Un fallo que
   * señala al sitio equivocado cuesta más que no tenerlo.
   */
  const apareció = await campo
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!apareció) return;

  /*
   * Un PIN puesto a mano, para cuando el correo del proveedor va a un buzón que
   * esta corrida no puede leer —una cuenta real, por ejemplo—.
   *
   * NO debilita lo que la prueba afirma: el PIN lo emitió el proveedor de
   * verdad, contra esta sesión, y hay que escribirlo en la misma pantalla. Lo
   * único que deja de estar automatizado es ABRIR EL CORREO. Muy distinto de
   * apagar `AUTH_LOGIN_PIN_ENABLED`, que sí dejaría la corrida verde sin haber
   * probado el acceso que corre de verdad.
   *
   * Es de UN SOLO USO y caduca en minutos, así que sirve para UNA entrada:
   * acota la corrida a una prueba (`--grep`) o el resto fallará al reintentar
   * el acceso, que es lo correcto —no hay que fingir que un PIN gastado sigue
   * valiendo—.
   */
  const pinAMano = (await pinDeArchivo()) ?? process.env.PW_LOGIN_PIN?.trim();

  if (!buzon && !pinAMano) {
    throw new Error(
      'El proveedor de identidad pidió un PIN de segundo factor y no hay forma de leerlo. ' +
        'Pásalo con PW_LOGIN_PIN=<codigo> para una entrada suelta, o levanta el recolector con ' +
        'PW_PIN_INBOX_PORT=<puerto> apuntando ahí el canal de correo del proveedor ' +
        '(NOTIFICATION_EMAIL_PROVIDER=webhook) para que la corrida sea autónoma. No apagues ' +
        'AUTH_LOGIN_PIN_ENABLED: la corrida quedaría verde sin haber probado el acceso real.',
    );
  }

  await campo.fill(pinAMano ?? (await buzon!.esperarPin(CREDENCIALES.email)));
  await page.getByRole('button', { name: /confirmar acceso/i }).click();
}

/**
 * Espera a que alguien deje el PIN en un archivo, y lo consume.
 *
 * Existe por un detalle que sólo se ve intentándolo: **cada intento de acceso
 * emite un PIN nuevo e invalida el anterior**. Un código pasado por adelantado
 * —`PW_LOGIN_PIN`— ya está caducado cuando la corrida llega a la pantalla,
 * porque la propia corrida generó otro al escribir la contraseña. Se comprobó:
 * el portal respondió «el código no es válido; los códigos sirven una sola vez».
 *
 * Así que la corrida se DETIENE aquí y espera al código que el proveedor acaba
 * de mandar. Sigue sin debilitar lo que la prueba afirma: el PIN es real, es de
 * esta sesión, y hay que escribirlo en la misma pantalla; lo único que no está
 * automatizado es abrir el correo.
 *
 *   PW_PIN_FILE=/ruta/pin.txt yarn playwright test … --grep "login real"
 *   # y cuando llegue el correo:  echo 123456 > /ruta/pin.txt
 */
async function pinDeArchivo(): Promise<string | null> {
  const ruta = process.env.PW_PIN_FILE;
  if (!ruta) return null;

  const limite = Number(process.env.PW_PIN_TIMEOUT_MS ?? 300_000);
  const hasta = Date.now() + limite;
  process.stdout.write(
    `\n  Esperando el PIN de segundo factor en ${ruta} (hasta ${Math.round(limite / 1000)} s).\n` +
      `  Escribe ahí el código que acabas de recibir: echo <codigo> > ${ruta}\n\n`,
  );

  while (Date.now() < hasta) {
    const leido = await readFile(ruta, 'utf8').catch(() => null);
    const codigo = leido?.replace(/\D/g, '');
    if (codigo && codigo.length >= 4) {
      // Se BORRA al usarlo: un PIN es de un solo uso, y dejarlo en disco haría
      // que la siguiente corrida lo reintentara y fallara sin decir por qué.
      await rm(ruta, { force: true });
      return codigo;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return null;
}

/**
 * Localizadores del formulario de acceso, en un solo sitio.
 *
 * El campo de tenant no tiene `name` ni `autocomplete` —es un `<label>` que
 * envuelve al `<input>`—, así que se localiza por su `inputmode`, que sí es
 * único en esa pantalla. Buscarlo por `name` fallaba en silencio hasta agotar el
 * reloj de la prueba, y el fallo no decía nada del portal.
 */
export function campoTenant(page: Page): Locator {
  return page.locator('.login-form input[inputmode="numeric"]').first();
}

export function campoCorreo(page: Page): Locator {
  return page.locator('.login-form input[autocomplete="username"]').first();
}

export function campoClave(page: Page): Locator {
  return page.locator('.login-form input[autocomplete="current-password"]').first();
}

/**
 * El campo del segundo paso. Se localiza por su clase y no por `inputmode`, que comparte con el
 * campo de tenant: los dos viven en `.login-form` y el localizador genérico habría cogido el
 * primero que existiera, que es justo el que no está en pantalla.
 */
export function campoPin(page: Page): Locator {
  return page.locator('.login-pin-input').first();
}

export function botonEntrar(page: Page): Locator {
  return page.getByRole('button', { name: /iniciar sesión|verificando acceso/i }).first();
}

/** El aviso de fallo del acceso, que el formulario pinta como `role="alert"`. */
export function avisoAcceso(page: Page): Locator {
  return page.locator('.login-problem[role="alert"]').first();
}
