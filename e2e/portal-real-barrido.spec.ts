import { expect, test } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';
import { deAplicacion, deIdentidad, deLimite, vigilar } from './support/real-portal-watch';
import { esperarVista, resolverRutas } from './support/real-portal-sweep';
import { REVISION_DE_VISTA, type RevisionDeVista } from './support/real-portal-review';

/**
 * BARRIDO del portal entero: todas las vistas, sus controles y sus diálogos.
 *
 * Va en su propio archivo y se corre aparte porque es lo más caro de la
 * batería: recorre decenas de vistas y gasta el limitador de peticiones del
 * motor. Mezclado con las pruebas del clasificador las dejaba sin presupuesto y
 * hacía que se saltaran solas, en verde y sin comprobar nada.
 */

test.describe.configure({ mode: 'serial' });

test.describe('barrido del portal · motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  /* ------------------------------------------------------------------ *
   * 8 · Navegación con teclado y salida de sesión
   * ------------------------------------------------------------------ */

  test('el portal es navegable con teclado desde el salto de contenido', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    const problemas = vigilar(page, () => '/workers');
    await entrar(page);
    await page.goto('/workers', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await esperarVista(page);

    // El primer tabulado tiene que ofrecer el salto al contenido: sin él, quien
    // navega con teclado recorre el menú entero en cada vista.
    await page.keyboard.press('Tab');
    const primero = await page.evaluate(() => document.activeElement?.textContent ?? '');
    expect(primero.toLowerCase(), 'el primer foco debe ser el salto al contenido').toMatch(
      /contenido|saltar|main/,
    );

    // Y el foco tiene que verse. Un anillo invisible deja a quien tabula sin
    // saber dónde está.
    const anillo = await page.evaluate(() => {
      const activo = document.activeElement as HTMLElement | null;
      if (!activo) return '';
      const estilo = getComputedStyle(activo);
      return `${estilo.outlineStyle} ${estilo.outlineWidth} ${estilo.boxShadow}`;
    });
    expect(anillo, 'el elemento enfocado debe tener indicador visible').not.toMatch(
      /^none 0px none$/,
    );

    expect(deAplicacion(problemas)).toEqual([]);
  });

  /* ------------------------------------------------------------------ *
   * Los dos barridos van AL FINAL, y no es cosmético.
   *
   * Recorren decenas de vistas y gastan el limitador de peticiones del motor
   * (`RATE_LIMIT_MANAGEMENT_REQUESTS`, 300 por minuto). Puestos delante, dejaban
   * sin presupuesto a las pruebas del clasificador: el catálogo del worker
   * llegaba con 429, la vista lo leía como «worker no disponible» y la prueba se
   * SALTABA — en verde, sin haber comprobado nada. Lo caro va detrás de lo que
   * de verdad hay que demostrar.
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * 2 · Todas las rutas: se pintan, no desbordan y sus controles tienen nombre
   * ------------------------------------------------------------------ */

  test('las 43 rutas se pintan sin errores y con controles nombrados', async ({ page }) => {
    test.setTimeout(30 * 60_000);
    let ruta = '/login';
    const problemas = vigilar(page, () => ruta);
    await entrar(page);

    const sinNombre: string[] = [];
    const vacias: string[] = [];
    const desbordan: string[] = [];

    /*
     * Los identificadores se descubren de la base, no se fijan a `/1`.
     *
     * Con `/1` el barrido recorría catorce pantallas de «no encontrado» creyendo
     * que recorría catorce vistas de detalle: pasaba en verde sin haber probado
     * ninguna. Lo que no tiene datos se informa abajo y NO se da por probado.
     */
    const { rutas, sinDatos } = await resolverRutas(page);
    console.log(`  rutas navegadas: ${rutas.length}`);
    console.log(`  detalles sin datos en esta base (NO probados): ${sinDatos.length}`);
    for (const vacia of sinDatos) console.log(`    sin datos · ${vacia}`);

    for (const destino of rutas) {
      ruta = destino;

      await page.goto(destino, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await esperarVista(page);
      /*
       * Un respiro entre rutas.
       *
       * El motor valida el token contra el proveedor de identidad en CADA
       * petición y sin caché, así que un barrido a toda velocidad lo agota y
       * devuelve 502/503 en rutas al azar. El respiro no arregla ese defecto
       * —se informa aparte—, sólo evita que su ruido decida el resultado de un
       * barrido que mide otra cosa.
       */
      await page.waitForTimeout(1_200);

      /*
       * Las cuatro medidas se toman en UNA sola llamada al navegador.
       *
       * Antes se recorrían los controles uno a uno desde el proceso de la
       * prueba, y cada `innerText` era un viaje de ida y vuelta: en las vistas
       * con tabla —cientos de enlaces— el barrido pasó de minutos a más de una
       * hora y acabó muriendo por reloj. La medición es la misma; lo que cambia
       * es dónde se ejecuta el bucle.
       */
      const medida = (await page.evaluate(REVISION_DE_VISTA)) as RevisionDeVista;

      // 2.1 · La vista pintó algo suyo. Un encabezado ausente casi siempre
      //       significa que la ruta cayó en el límite de error.
      if (medida.encabezados === 0) vacias.push(destino);

      // 2.2 · Ningún límite de error de React a la vista.
      expect(medida.limiteDeError, `${destino} muestra un límite de error`).toBe(false);

      // 2.3 · Todo control interactivo tiene nombre accesible.
      for (const anonimo of medida.sinNombre) sinNombre.push(`${destino} → ${anonimo}`);

      // 2.4 · A 1280 ninguna vista debe desbordar en horizontal.
      if (medida.desborde > 1) desbordan.push(`${destino} desborda ${medida.desborde}px`);
    }

    expect(rutas.length, 'el barrido debe cubrir la mayor parte de la matriz').toBeGreaterThan(25);
    expect(vacias, 'rutas que no pintaron ningún encabezado').toEqual([]);
    expect(sinNombre, 'controles sin nombre accesible').toEqual([]);
    expect(desbordan, 'rutas que desbordan en horizontal a 1280').toEqual([]);
    /*
     * El ruido de identidad se informa aparte y NO tumba el barrido: su causa
     * está medida y es ajena a la vista que se está probando (ver `Problema`).
     * Taparlo sería mentir; mezclarlo, hacer inútil el barrido.
     */
    const identidad = deIdentidad(problemas);
    const limite = deLimite(problemas);
    console.log(`  fallos por validación de identidad (defecto aparte): ${identidad.length}`);
    for (const fallo of identidad.slice(0, 12)) console.log(`    identidad · ${fallo}`);
    console.log(`  peticiones rechazadas por el limitador (429): ${limite.length}`);
    for (const fallo of limite.slice(0, 8)) console.log(`    límite · ${fallo}`);

    expect(
      deAplicacion(problemas),
      'errores de consola o respuestas 5xx propios de las vistas',
    ).toEqual([]);
  });
});
