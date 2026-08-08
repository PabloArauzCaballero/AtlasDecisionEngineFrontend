import type { InteractiveStep } from './interactive-types';

/**
 * Primer paso de los recorridos de FICHA (`/artifacts/{id}`, `/executions/{id}`…).
 *
 * Estos tutoriales enseñan el detalle de un registro concreto, pero su ruta
 * depende de cuál se abra: el motor no puede inventar un identificador. Antes,
 * lanzarlos desde el Centro dejaba a la persona en el listado con la tarjeta
 * explicando elementos que no estaban en pantalla.
 *
 * Con este paso el recorrido lleva al listado, pide abrir un registro —y espera
 * el clic de verdad— y a partir del siguiente paso se queda donde el usuario
 * haya llegado (`dynamicRoute`).
 *
 * La instrucción vive AQUÍ y no en cada llamada porque escribirla a mano cuatro
 * veces ya salió mal una: decía "haz clic en cualquier fila", y en este portal
 * pulsar una fila la despliega, no la abre. La ficha se abre con el icono "Ver
 * detalle" de la columna de acciones (`DataTable` → `detailPath`).
 */
export function openRecordStep(route: string, what: string): InteractiveStep {
  return {
    id: 'open-record',
    route,
    target: '[data-tutorial-id="resource-table"]',
    title: `Abre ${what}`,
    content: `Este recorrido explica la ficha completa de ${what}, así que primero hay que abrir una. Pulsa el icono “Ver detalle” —el ojo, al final de la fila— en cualquier registro de la tabla.`,
    tip: 'Si ya tienes una ficha abierta, usa “Saltar este paso” y seguimos desde ahí.',
    requiredAction: 'click',
    // El listado puede venir vacío en un entorno recién sembrado: sin esto, el
    // recorrido se quedaría esperando un clic sobre una tabla sin filas.
    optional: true,
  };
}

/**
 * Marca el paso como "el recorrido sigue al usuario". Se aplica al primer paso
 * que ya ocurre dentro de la ficha, justo después de `openRecordStep`.
 */
export function inRecord(step: InteractiveStep): InteractiveStep {
  return { ...step, dynamicRoute: true };
}
