import { expect, test, type Page } from '@playwright/test';
import { abrirCuadernoDeTrabajo, mockDataNotebookBackend } from './support/data-notebook-backend';
import { escribirEnCelda } from './support/notebook-editor';
import { elegirOpcion } from './support/option-select';

/**
 * MOT-03: el código de una celda NO actúa como la persona que la ejecuta.
 *
 * Antes, Python corría en la pestaña del portal (`import js` llegaba a `fetch`, `document` y la
 * cookie de sesión), y JavaScript y R en workers del mismo origen (sin DOM, pero con la cookie y
 * con `/v1/*` al alcance). Ahora los tres corren en workers dentro de un
 * `<iframe sandbox="allow-scripts">` de origen opaco, con una CSP cuya única red son los ficheros
 * estáticos de `/pyodide/` y `/webr/`.
 *
 * Se comprueba desde DENTRO de una celda, que es donde estaría el código hostil: pedir
 * `/v1/session/refresh`, leer `document.cookie` y llegar a `parent.document` tienen que FALLAR, y el
 * servidor no debe ver ni una petición de refresco salida de la celda.
 */

const PLAZO_INTERPRETE = 240_000;

async function abrir(page: Page) {
  await mockDataNotebookBackend(page);
  await abrirCuadernoDeTrabajo(page);
}

/** Cuenta las peticiones de refresco de sesión que llegan a la red, venga de donde venga. */
function contarRefrescos(page: Page) {
  const contador = { n: 0 };
  page.context().on('request', (peticion) => {
    if (peticion.url().includes('/v1/session/refresh')) contador.n += 1;
  });
  return contador;
}

/**
 * Las peticiones de refresco que LLEGARON a la red (con respuesta) y las que el navegador cortó por
 * la CSP. Una XHR síncrona desde un worker dispara el evento `request` aunque la CSP la bloquee
 * antes de salir; contarla como «salió» sería un falso positivo, así que se separan.
 */
function vigilarRefrescos(page: Page) {
  const vigia = { respondidas: 0, cortadasPorCsp: 0 };
  page.context().on('response', (respuesta) => {
    if (respuesta.url().includes('/v1/session/refresh')) vigia.respondidas += 1;
  });
  page.context().on('requestfailed', (peticion) => {
    if (peticion.url().includes('/v1/session/refresh') && peticion.failure()?.errorText === 'csp') {
      vigia.cortadasPorCsp += 1;
    }
  });
  return vigia;
}

async function salidaDeLaCelda(page: Page) {
  const salida = page.locator('.notebook-cell__output').first();
  const caido = page.locator('.notebook-runtime--unavailable');
  await expect(salida.or(caido).first()).toBeVisible({ timeout: PLAZO_INTERPRETE });
  if (await caido.isVisible())
    throw new Error(`El intérprete no arrancó: ${await caido.innerText()}`);
  return salida;
}

test.describe('cuaderno de datos · aislamiento de las celdas', () => {
  test('el marco es opaco: sin cookies ni acceso al portal', async ({ page }) => {
    await abrir(page);
    await elegirOpcion(page.locator('.notebook-cell__language [role="combobox"]'), 'javascript');
    await escribirEnCelda(page, 0, 'return 1;');
    await page.locator('.notebook-cell__run').first().click();
    await salidaDeLaCelda(page);

    const iframe = page.locator('iframe[title="Entorno aislado del cuaderno"]');
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');

    const marco = page.frames().find((frame) => frame.url().endsWith('/notebook-sandbox'));
    expect(marco, 'el marco aislado tiene que existir').toBeTruthy();
    const dentro = await marco!.evaluate(() => {
      const intento = (accion: () => unknown) => {
        try {
          return `PASÓ: ${String(accion())}`;
        } catch (error) {
          return `bloqueado: ${(error as Error).name}`;
        }
      };
      return {
        origen: self.origin,
        cookie: intento(() => document.cookie),
        padre: intento(() => window.parent.document.title),
        almacen: intento(() => window.localStorage.length),
      };
    });
    expect(dentro.origen).toBe('null');
    expect(dentro.cookie).toMatch(/^bloqueado/);
    expect(dentro.padre).toMatch(/^bloqueado/);
    expect(dentro.almacen).toMatch(/^bloqueado/);
  });

  test('una celda de JavaScript no puede refrescar la sesión ni tocar el portal', async ({
    page,
  }) => {
    const refrescos = contarRefrescos(page);
    await abrir(page);
    const origen = new URL(page.url()).origin;
    const antes = refrescos.n;

    await elegirOpcion(page.locator('.notebook-cell__language [role="combobox"]'), 'javascript');
    await escribirEnCelda(
      page,
      0,
      [
        'const r = {};',
        'const intento = async (nombre, accion) => {',
        "  try { await accion(); r[nombre] = 'PASÓ'; } catch (e) { r[nombre] = 'bloqueado: ' + e.name; }",
        '};',
        `await intento('fetch', () => fetch('${origen}/v1/session/refresh', { method: 'POST', credentials: 'include' }));`,
        "await intento('fetchRelativo', () => fetch('/v1/session/refresh', { method: 'POST' }));",
        "await intento('cookie', () => document.cookie);",
        "await intento('padre', () => parent.document.title);",
        'console.log(JSON.stringify(r));',
        'return r;',
      ].join('\n'),
    );
    await page.locator('.notebook-cell__run').first().click();

    const salida = await salidaDeLaCelda(page);
    const registro = page.locator('.notebook-cell__logs');
    await expect(registro).toContainText('"fetch":"bloqueado: TypeError"');
    await expect(registro).toContainText('"fetchRelativo":"bloqueado: TypeError"');
    await expect(registro).toContainText('"cookie":"bloqueado: ReferenceError"');
    await expect(registro).toContainText('"padre":"bloqueado: ReferenceError"');
    await expect(salida).not.toContainText('PASÓ');
    expect(refrescos.n, 'ninguna petición de refresco salió de la celda').toBe(antes);
  });

  test('una celda de Python no alcanza la red ni el DOM del portal', async ({ page }) => {
    test.slow();
    const refrescos = contarRefrescos(page);
    await abrir(page);
    const origen = new URL(page.url()).origin;
    const antes = refrescos.n;

    await escribirEnCelda(
      page,
      0,
      // Sin bloques indentados: Monaco reindenta lo que se teclea. La petición va la ÚLTIMA y
      // sin capturar, para que su error sea el de la celda y se lea entero.
      [
        'import js',
        'print("datos:", len(rows))',
        'print({n: ("PASO" if hasattr(js, n) else "bloqueado") for n in ["document", "parent", "window", "localStorage"]})',
        `await js.fetch("${origen}/v1/session/refresh")`,
      ].join('\n'),
    );
    await page.locator('.notebook-cell__run').first().click();

    const salida = await salidaDeLaCelda(page);
    const registro = page.locator('.notebook-cell__logs');
    // Los datos sí llegaron: el aislamiento no deja la celda sin dataset.
    await expect(registro).toContainText('datos: 100');
    for (const nombre of ['document', 'parent', 'window', 'localStorage']) {
      await expect(registro).toContainText(`'${nombre}': 'bloqueado'`);
    }
    await expect(salida).not.toContainText('PASO');
    // La petición la corta la CSP del marco antes de salir: «Failed to fetch» dentro de la celda.
    await expect(page.locator('.notebook-cell__error')).toContainText('Failed to fetch');
    expect(refrescos.n, 'ninguna petición de refresco salió de la celda').toBe(antes);
  });

  /**
   * R corría en un worker del MISMO origen (`/webr/webr-worker.js`): `webr::eval_js` le daba
   * `fetch` con la cookie de sesión y un `connect-src 'self'` que alcanzaba `/v1/*`. Ahora su
   * worker nace en el marco aislado; desde R, la petición de refresco tiene que fallar y la cookie
   * no tiene que existir.
   */
  test('una celda de R no puede refrescar la sesión ni leer cookies', async ({ page }) => {
    test.slow();
    const refrescos = vigilarRefrescos(page);
    await abrir(page);
    const origen = new URL(page.url()).origin;
    const antes = refrescos.respondidas;

    await elegirOpcion(page.locator('.notebook-cell__language [role="combobox"]'), 'r');
    await escribirEnCelda(
      page,
      0,
      [
        'cat("datos:", nrow(df), "\\n")',
        "cat('origen:', webr::eval_js('String(self.origin)'), '\\n')",
        "cat('cookie:', webr::eval_js('typeof document'), '\\n')",
        `cat('red:', webr::eval_js("(function () { try { var x = new XMLHttpRequest(); x.open('POST', '${origen}/v1/session/refresh', false); x.send(); return 'PASO ' + x.status; } catch (e) { return 'bloqueado ' + e.name; } })()"), '\\n')`,
        `readLines(url("${origen}/v1/session/refresh"))`,
      ].join('\n'),
    );
    await page.locator('.notebook-cell__run').first().click();

    const salida = await salidaDeLaCelda(page);
    const registro = page.locator('.notebook-cell__logs');
    // Los datos sí llegaron: el aislamiento no deja la celda sin dataset.
    await expect(registro).toContainText('datos: 100');
    await expect(registro).toContainText('origen: null');
    // En el worker no hay `document`, así que tampoco `document.cookie`.
    await expect(registro).toContainText('cookie: undefined');
    await expect(registro).toContainText('red: bloqueado');
    await expect(salida).not.toContainText('PASO');
    // `url()` de R también choca: la celda termina en error, no con la respuesta del portal.
    await expect(page.locator('.notebook-cell__error')).toBeVisible();
    // Lo intentó, y fue la CSP del marco de R la que lo cortó dentro del navegador.
    expect(refrescos.cortadasPorCsp, 'la CSP del marco cortó el intento').toBeGreaterThan(0);
    expect(refrescos.respondidas, 'ninguna petición de refresco salió de la celda').toBe(antes);
  });
});
