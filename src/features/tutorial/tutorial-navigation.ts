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
    const route = tutorial.steps[i]?.route;
    if (route) return route;
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
