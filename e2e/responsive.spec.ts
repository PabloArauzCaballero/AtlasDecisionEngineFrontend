import { expect, test } from '@playwright/test';
import { mockBackend } from './support/backend-mock';
import { denseBackend } from './support/dense-backend';
import { GATE_ROUTES, GATE_WIDTHS } from './support/responsive-matrix';

/**
 * Ninguna vista debe salirse a lo ancho.
 *
 * Esta prueba medía `documentElement.scrollWidth` contra `clientWidth`, que es
 * la definición de manual del desbordamiento horizontal. En ESTE portal no
 * medía nada: `.app-shell` lleva `overflow-x: clip`, y un contenedor recortado
 * no propaga hacia arriba el ancho de su contenido. Comprobado inyectando un
 * bloque del doble de ancho que la ventana (`e2e/overflow-detector.spec.ts`): el
 * bloque se sale —su borde derecho llega a 720 px con ventana de 360— y
 * `scrollWidth` se queda exactamente igual. La prueba pasaba por construcción.
 *
 * Lo que sí distingue una vista sana de una rota es el BORDE DERECHO de cada
 * elemento: el recorte lo esconde, pero no lo mueve. Se exceptúan tres cosas, y
 * cada una por un motivo que se puede defender:
 *
 *  1. `position: fixed` — velos y cajones se colocan fuera del flujo a
 *     propósito; su sitio es la ventana, no la columna.
 *  2. Lo que cuelga de algo que desplaza en horizontal (`overflow-x: auto` o
 *     `scroll`): ahí salirse ES el diseño, para eso desplaza.
 *  3. Lo que no está en pantalla: `opacity: 0` o `visibility: hidden`. Un globo
 *     de ayuda cerrado no corta nada; su estado abierto es otro estado.
 *  4. `[aria-hidden="true"]` — el fondo ambiental (`.ambient-bg`) son manchas
 *     de luz de 1070 px que se salen 214 px por diseño y a las que el recorte
 *     del marco les da su forma. La aplicación ya declara que no son contenido;
 *     medirlas como si lo fueran sólo obligaría a apagar la comprobación.
 *
 * Las cuatro se preguntan por el COMPORTAMIENTO del elemento —dónde se coloca,
 * si desplaza, si se ve, si se declara decoración—, nunca por su nombre de
 * clase. Una lista de clases envejece: la anterior decía `.table-wrap` y se
 * quedó corta el día que otra tabla empezó a desplazar por su cuenta.
 *
 * Y las cuatro se comprueban sobre la CADENA de ancestros, no sobre el nodo
 * suelto. Mirar sólo al nodo bastaba mientras se medía un único borde; al medir
 * también el izquierdo aparecieron 27 fallos por vista que no eran defectos: el
 * cajón de navegación es `fixed` y bajo 820 px se aparca con
 * `translateX(-101%)`, así que todos sus hijos —estáticos— quedan en left ≈
 * -273. No están rotos, están guardados, que es lo que hace un cajón cerrado.
 */
const OFENSORES = `(() => {
  const doc = document.documentElement;
  const limite = doc.clientWidth + 1; // 1 px absorbe el redondeo al escalar.
  const fuera = [];
  for (const nodo of document.querySelectorAll('body *')) {
    const caja = nodo.getBoundingClientRect();
    if (caja.width === 0) continue;
    // Los DOS bordes: anclar un globo a la derecha lo puede sacar por la izquierda.
    const derecha = caja.right - limite;
    const izquierda = -caja.left;
    if (derecha <= 0 && izquierda <= 1) continue;
    // Se pregunta por el comportamiento del elemento y de sus ancestros, nunca
    // por su clase. Ver el bloque de arriba para el porqué de cada descarte.
    let ancestro = nodo;
    let descartar = false;
    while (ancestro && ancestro !== document.body) {
      const cs = getComputedStyle(ancestro);
      if (cs.position === 'fixed') { descartar = true; break; }
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') { descartar = true; break; }
      if (cs.opacity === '0' || cs.visibility === 'hidden') { descartar = true; break; }
      ancestro = ancestro.parentElement;
    }
    if (descartar) continue;
    if (nodo.closest('[data-scroll-x]')) continue;
    if (nodo.closest('[aria-hidden="true"]')) continue;
    const clase = (nodo.className || '').toString().split(' ')[0] || '(sin clase)';
    const lado = derecha > 0
      ? 'se sale ' + Math.round(derecha) + 'px por la derecha'
      : 'se sale ' + Math.round(izquierda) + 'px por la izquierda';
    fuera.push(nodo.tagName.toLowerCase() + '.' + clase + ' ' + lado);
  }
  return [...new Set(fuera)];
})()`;

for (const width of GATE_WIDTHS) {
  test.describe(`${width}px`, () => {
    for (const route of GATE_ROUTES) {
      test(`${route} cabe a lo ancho`, async ({ page }) => {
        // El listado denso llena las tablas: una vista vacía nunca se sale y no
        // demostraría nada. El editor de grafo necesita su propio simulado.
        await (route === '/graph-editor' ? mockBackend(page) : denseBackend(page));
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(700);

        const fuera = await page.evaluate<string[]>(OFENSORES);
        expect(fuera, `${route} a ${width}px`).toEqual([]);
      });
    }
  });
}

/**
 * Áreas táctiles: WCAG 2.2 nivel AA, criterio 2.5.8 («Target Size Minimum»),
 * 24×24 px.
 *
 * No es una métrica abstracta: medido antes de esta corrección, el encabezado
 * ordenable de TODA tabla del portal medía 47×14 px y el enlace «Simulate» de
 * la barra superior 65×15. Ordenar una tabla —la acción más repetida que hay
 * aquí— era cuestión de puntería con el dedo.
 *
 * Se excluye el patrón `sr-only`: un control de 1×1 oculto a la vista pero
 * disponible para lectores de pantalla es intencionado, no un descuido.
 */
const PEQUENOS = `(() => {
  const malos = [];
  const selector = 'button, a[href], select, [role="button"], [role="tab"]';
  for (const nodo of document.querySelectorAll(selector)) {
    if (nodo.closest('.sr-only') || nodo.classList.contains('sr-only')) continue;
    const caja = nodo.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) continue; // no visible
    if (caja.width >= 24 && caja.height >= 24) continue;
    const clase = (nodo.className || '').toString().split(' ')[0] || '(sin clase)';
    malos.push(nodo.tagName.toLowerCase() + '.' + clase + ' mide ' + Math.round(caja.width) + '×' + Math.round(caja.height));
  }
  return [...new Set(malos)];
})()`;

for (const route of ['/variables', '/platform-health', '/test-cases'] as const) {
  test(`${route}: ningún control por debajo de 24×24`, async ({ page }) => {
    await denseBackend(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const pequenos = await page.evaluate<string[]>(PEQUENOS);
    expect(pequenos, `${route} a 390px`).toEqual([]);
  });
}

/**
 * Zoom del navegador al 200 % — WCAG 1.4.4 («Resize Text»).
 *
 * Ampliar al 200 % en una pantalla de 1280×1024 deja **exactamente** la mitad de
 * píxeles CSS disponibles: 640×512. Esa equivalencia es lo que permite medirlo
 * sin controlar el zoom real del navegador, que Playwright no expone: se pide
 * una ventana de 640×512 y se comprueba lo mismo que a cualquier otro ancho.
 *
 * Lo que se afirma es lo que exige el criterio: que no se pierda contenido ni
 * funcionalidad. Un elemento que se sale es contenido perdido —aquí, además,
 * perdido en silencio, porque el marco recorta—.
 */
for (const route of ['/platform-health', '/variables', '/simulator'] as const) {
  test(`${route}: al 200 % de zoom no se pierde contenido`, async ({ page }) => {
    await denseBackend(page);
    // 1280×1024 al 200 % = 640×512 píxeles CSS.
    await page.setViewportSize({ width: 640, height: 512 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const fuera = await page.evaluate<string[]>(OFENSORES);
    expect(fuera, `${route} al 200 % (640×512)`).toEqual([]);
  });
}

/**
 * El zoom no puede estar bloqueado.
 *
 * `maximum-scale` o `user-scalable=no` en la etiqueta `viewport` impiden ampliar
 * en móvil, que es donde más falta hace. Es un incumplimiento de WCAG 1.4.4 que
 * no se ve mirando la pantalla —sólo se nota al intentar el gesto— y que entra
 * en el proyecto con una línea. `layout.next.tsx` declara lo contrario a
 * propósito; esto lo vigila.
 */
test('la etiqueta viewport no bloquea el zoom', async ({ page }) => {
  await denseBackend(page);
  await page.goto('/platform-health', { waitUntil: 'domcontentloaded' });

  const contenido = await page.getAttribute('meta[name="viewport"]', 'content');
  expect(contenido, 'no hay etiqueta viewport').toBeTruthy();
  expect(contenido, `viewport bloquea el zoom: ${contenido}`).not.toMatch(
    /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*[01](\.\d+)?\b/,
  );
});
