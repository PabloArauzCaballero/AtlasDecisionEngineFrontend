import type { Page } from '@playwright/test';

/**
 * Lo que comparten las pruebas de contraste: el listón, el inventario de rutas
 * y las dos piezas de medición.
 *
 * El reparto es a propósito. Aquí vive lo que no debe poder discrepar —un
 * umbral escrito dos veces acaba valiendo dos cosas— y lo que sabe recorrer el
 * DOM pintado. Cada especificación decide lo suyo: qué rutas visitar, qué
 * estados abrir y qué pseudo-clases forzar.
 */

/**
 * Presupuesto de tiempo para un barrido de rutas.
 *
 * Es alto a propósito y no esconde nada: en desarrollo, Turbopack compila cada
 * ruta la primera vez que alguien la pide, así que recorrer dos docenas de
 * vistas cuesta minutos por más rápido que sea la medición. El presupuesto
 * cubre el peor caso —servidor recién arrancado, caché vacía— para que un
 * fallo signifique siempre "hay un problema de contraste" y nunca "hoy la
 * máquina iba lenta".
 */
export const SWEEP_TIMEOUT_MS = 600_000;

/**
 * El AA de WCAG para texto normal. Vive aquí y no en cada especificación porque
 * un umbral repetido es un umbral que acabará valiendo dos cosas distintas.
 */
export const AA_FLOOR = 4.5;

/** Una ruta por familia de la plataforma: el barrido completo. */
export const ALL_ROUTES = [
  '/platform-health',
  '/tutorials',
  '/artifacts',
  '/algorithms',
  '/variables',
  '/reason-codes',
  '/executions',
  '/audit-events',
  '/reviews',
  '/test-suites',
  '/test-cases',
  '/graph-coverage',
  '/coverage-matrix',
  '/deployments',
  '/environments',
  '/objectives',
  '/manual-reviews',
  '/simulator',
  '/graph-editor',
  '/code-import',
  '/calculated-fields',
  '/libraries',
  '/qa-lab',
  '/actions',
  '/search',
] as const;

/**
 * Subconjunto para los barridos que se multiplican por combinaciones.
 *
 * Medir seis combinaciones de pseudo-estados sobre las 24 rutas costaría media
 * hora y no añadiría nada: los estilos de `:hover` y `:focus` son transversales
 * —viven en `controls.css`, no en la hoja de cada vista—, así que una muestra
 * que toque todas las familias de controles los cubre igual.
 */
export const SAMPLE_ROUTES = [
  '/platform-health',
  '/artifacts',
  '/variables',
  '/executions',
  '/reviews',
  '/deployments',
  '/objectives',
  '/simulator',
  '/graph-editor',
  '/qa-lab',
] as const;

export interface Offender {
  selector: string;
  color: string;
  background: string;
  ratio: number;
  text: string;
}

export interface Measurement {
  offenders: Offender[];
  /** Nodos de texto que se llegaron a examinar. Un cero delata una página vacía. */
  inspected: number;
}

export async function lowContrastNodes(page: Page, floor: number): Promise<Measurement> {
  return page.evaluate((limit) => {
    const parse = (value: string): [number, number, number, number] | null => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) return null;
      const parts = m[1]!.split(',').map((p) => parseFloat(p.trim()));
      return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
    };
    const luminance = ([r, g, b]: number[]) => {
      const lin = [r!, g!, b!].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
    };
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };

    /** Primer ancestro con fondo opaco: es lo que el ojo ve detrás del texto. */
    const backdrop = (element: Element): [number, number, number, number] => {
      let node: Element | null = element;
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg[3] > 0.85) return bg;
        node = node.parentElement;
      }
      return [11, 17, 32, 1];
    };

    const describe = (element: Element) => {
      const classes = [...element.classList].slice(0, 2).join('.');
      return classes
        ? `${element.tagName.toLowerCase()}.${classes}`
        : element.tagName.toLowerCase();
    };

    const found: Offender[] = [];
    let inspected = 0;
    for (const element of document.body.querySelectorAll('*')) {
      // Sólo nodos con texto propio y visible.
      const own = [...element.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (!own) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (parseFloat(style.opacity) < 0.5) continue;
      const box = element.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;

      const color = parse(style.color);
      if (!color || color[3] < 0.5) continue;
      const bg = backdrop(element);
      const value = ratio(color, bg);
      inspected += 1;
      if (value < limit) {
        found.push({
          selector: describe(element),
          color: style.color,
          background: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,
          ratio: Math.round(value * 100) / 100,
          text: own.slice(0, 40),
        });
      }
    }
    return { offenders: found, inspected };
  }, floor);
}

/** Elementos que responden al puntero o al teclado. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="tab"], [tabindex]';

/**
 * Fuerza `:hover` (o `:focus-visible`) sobre TODOS los elementos interactivos y
 * ejecuta `medir` mientras siguen forzados.
 *
 * Se hace por el protocolo de depuración y no moviendo el ratón elemento a
 * elemento porque, para medir contraste, cada elemento se calcula por separado:
 * da igual que en la vida real sólo uno esté bajo el puntero. Lo que se gana es
 * pasar de cientos de interacciones por ruta a una sola medición.
 *
 * La medición va DENTRO y no después, y la sesión se cierra al final: al
 * desconectarla el navegador deshace el forzado, así que medir fuera devolvía
 * los estilos en reposo y la prueba pasaba sin haber comprobado nada. Se
 * descubrió comparando contra un `hover()` real, que sí cambiaba los colores.
 */
export type Pseudo = 'hover' | 'focus' | 'focus-visible' | 'active';

export async function withPseudoState<T>(
  page: Page,
  pseudo: Pseudo | readonly Pseudo[],
  medir: (forced: number) => Promise<T>,
): Promise<T> {
  const forcedPseudoClasses = Array.isArray(pseudo) ? [...pseudo] : [pseudo as Pseudo];
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = (await client.send('DOM.getDocument', { depth: -1 })) as {
      root: { nodeId: number };
    };
    const { nodeIds } = (await client.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: INTERACTIVE,
    })) as { nodeIds: number[] };

    for (const nodeId of nodeIds) {
      // Un nodo puede haberse ido entre la consulta y esta llamada; que uno
      // falle no debe tumbar la medición de los demás.
      await client
        .send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses })
        .catch(() => undefined);
    }
    return await medir(nodeIds.length);
  } finally {
    await client.detach().catch(() => undefined);
  }
}

/** Línea legible por incumplimiento, para el mensaje de fallo. */
export function describeOffenders(offenders: (Offender & { route: string })[]): string {
  return offenders
    .map(
      (o) =>
        `${o.route} · ${o.selector} · ${o.ratio}:1 · "${o.text}" (${o.color} sobre ${o.background})`,
    )
    .join('\n');
}
