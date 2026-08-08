import { expect, test } from '@playwright/test';
import { HAY_CREDENCIALES, entrar } from './support/real-portal';
import { deAplicacion, vigilar } from './support/real-portal-watch';
import {
  abreDialogo,
  esDestructiva,
  esperarVista,
  nombreDe,
  resolverRutas,
} from './support/real-portal-sweep';

/**
 * Los DIÁLOGOS del portal: que atrapen el foco y se cierren con Escape.
 *
 * Archivo propio, y por el mismo motivo que el resto de la batería: recorre
 * todas las vistas abriendo modales, y comparte minuto de cuota con nadie. Junto
 * al barrido de rutas, el limitador del motor le dejaba las vistas sin datos y
 * la prueba no encontraba ni un diálogo que abrir — pasaba a estar en verde por
 * no haber probado nada, que es exactamente lo que la última aserción impide.
 *
 * Aquí se detectó que el alta de despliegue atrapaba el foco sin dar salida por
 * teclado: `useDialogFocus` no manejaba Escape y sólo `ModalDialog` lo suplía.
 */

test.describe.configure({ mode: 'serial' });

test.describe('diálogos del portal · motor real', () => {
  test.skip(!HAY_CREDENCIALES, 'Define PW_USER y PW_PASSWORD con el stack levantado.');

  /* ------------------------------------------------------------------ *
   * 3 · Los diálogos: se abren, atrapan el foco y se cierran con Escape
   * ------------------------------------------------------------------ */

  test('todo diálogo atrapa el foco y se cierra con Escape', async ({ page }) => {
    test.setTimeout(30 * 60_000);
    let ruta = '/login';
    const problemas = vigilar(page, () => ruta);
    await entrar(page);

    const fallos: string[] = [];
    const abiertos: string[] = [];
    const omitidos: string[] = [];

    const { rutas } = await resolverRutas(page);

    for (const destino of rutas) {
      ruta = destino;
      await page.goto(destino, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await esperarVista(page);

      const botones = page.locator('button:visible, [role="button"]:visible');
      const total = Math.min(await botones.count(), 40);

      for (let i = 0; i < total; i += 1) {
        const boton = botones.nth(i);
        if (!(await boton.isVisible().catch(() => false))) continue;
        if (!(await boton.isEnabled().catch(() => false))) continue;

        const nombre = await nombreDe(boton);
        if (nombre === '') continue;
        if (esDestructiva(nombre)) {
          omitidos.push(`${destino} → «${nombre}»`);
          continue;
        }
        if (!abreDialogo(nombre)) continue;

        await boton.click({ timeout: 10_000 }).catch(() => undefined);
        const dialogo = page.locator('[role="dialog"][aria-modal="true"]').first();
        if (!(await dialogo.isVisible().catch(() => false))) continue;

        abiertos.push(`${destino} → «${nombre}»`);

        // 3.1 · El foco entra en el diálogo. Si se queda fuera, quien navega con
        //       teclado sigue tabulando por la página de detrás sin saberlo.
        const dentro = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
          return modal !== null && modal.contains(document.activeElement);
        });
        if (!dentro) fallos.push(`${destino} → «${nombre}»: el foco no entró en el diálogo`);

        // 3.2 · Escape lo cierra. Un modal sin salida por teclado es una trampa.
        await page.keyboard.press('Escape');
        if (await dialogo.isVisible().catch(() => false)) {
          fallos.push(`${destino} → «${nombre}»: Escape no lo cerró`);
          await page.keyboard.press('Escape');
          await page.mouse.click(5, 5).catch(() => undefined);
        }
      }
    }

    // Se informa de lo abierto y de lo omitido: sin esto, un barrido que no
    // encontró ni un diálogo se leería igual que uno que los probó todos.
    console.log(`  diálogos abiertos y comprobados: ${abiertos.length}`);
    console.log(`  botones destructivos NO pulsados: ${omitidos.length}`);
    for (const omitido of omitidos) console.log(`    omitido · ${omitido}`);

    expect(abiertos.length, 'el barrido no encontró ni un diálogo que abrir').toBeGreaterThan(0);
    expect(fallos, 'diálogos que no atrapan el foco o no cierran con Escape').toEqual([]);
    expect(deAplicacion(problemas)).toEqual([]);
  });
});
