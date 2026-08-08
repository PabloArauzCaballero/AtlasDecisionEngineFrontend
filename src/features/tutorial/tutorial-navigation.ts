import type { InteractiveTutorial } from './interactive-types';

/**
 * Navegación que necesita el motor, reducida a lo mínimo.
 *
 * El motor NO importa `next/navigation`: recibe esta interfaz desde el armazón
 * de la aplicación. Así el recorrido se puede probar sin montar un router y el
 * núcleo no queda atado al framework de rutas.
 */
export interface TutorialRouter {
  pathname: string;
  push: (route: string) => void;
}

/**
 * ¿Está el usuario en la pantalla del paso, o dentro de ella?
 *
 * `/artifacts/row-1` cuenta como estar en `/artifacts`: es la ficha que se abre
 * DESDE ese listado. Sin esta noción de descendencia había una carrera capaz de
 * romper cualquier recorrido de ficha: al pulsar "Ver detalle", la ruta cambia
 * antes de que el paso avance, el efecto de navegación se dispara todavía con
 * el paso del listado y empuja a la persona de vuelta al listado —justo al
 * entrar—, dejando el recorrido en un bucle del que no se sale.
 */
export function isAtRoute(pathname: string | undefined, route: string): boolean {
  if (!pathname) return false;
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** ¿Existe el elemento del paso en el DOM ahora mismo? */
export function targetExists(selector?: string): boolean {
  return selector ? Boolean(document.querySelector(selector)) : true;
}

/**
 * Índice del siguiente paso "aplicable" desde `from` en la dirección `dir`,
 * saltando los pasos opcionales cuyo target no existe en el DOM. Devuelve -1 si
 * se sale del rango (fin del recorrido).
 *
 * Un paso opcional que vive en OTRA ruta no se puede juzgar por el DOM actual:
 * su elemento no está porque todavía no hemos navegado, no porque falte. Esos se
 * conservan siempre; descartarlos aquí haría que un recorrido entre pantallas se
 * saltara justo los pasos que motivan el salto.
 */
export function applicableIndex(
  tutorial: InteractiveTutorial,
  from: number,
  dir: 1 | -1,
  currentPathname?: string,
): number {
  let index = from;
  while (index >= 0 && index < tutorial.steps.length) {
    const step = tutorial.steps[index];
    const elsewhere = Boolean(step.route) && step.route !== currentPathname;
    if (!step.optional || elsewhere || targetExists(step.target)) return index;
    index += dir;
  }
  return -1;
}

/**
 * Ruta en la que debe verse el paso `index`.
 *
 * Los pasos heredan la ruta del anterior que la declare: un recorrido de una
 * sola pantalla la escribe una vez y los que cambian de vista sólo la declaran
 * en el paso que cruza. Devuelve null si el recorrido no habla de rutas (los
 * tutoriales de error se hacen donde el usuario esté).
 */
export function routeForStep(tutorial: InteractiveTutorial, index: number): string | null {
  for (let i = Math.min(index, tutorial.steps.length - 1); i >= 0; i -= 1) {
    const step = tutorial.steps[i];
    // `dynamicRoute` corta la herencia: a partir de ahí el recorrido ocurre en
    // la ficha que el usuario haya abierto, cuya ruta el motor no puede
    // construir. Seguir heredando la del listado lo devolvería allí en bucle.
    if (step?.dynamicRoute) return null;
    if (step?.route) return step.route;
  }
  return null;
}

/** Ruta de entrada del recorrido: dónde hay que estar para el primer paso. */
export function entryRoute(tutorial: InteractiveTutorial): string | null {
  return routeForStep(tutorial, 0);
}

/**
 * Un paso guardado puede haber dejado de existir si el tutorial se reescribió
 * con menos pasos. Reanudar en un índice fuera de rango dejaría el recorrido en
 * blanco, así que se acota al último paso válido.
 */
export function clampStep(tutorial: InteractiveTutorial, step: number): number {
  if (!Number.isFinite(step) || step < 0) return 0;
  return Math.min(Math.trunc(step), Math.max(tutorial.steps.length - 1, 0));
}
