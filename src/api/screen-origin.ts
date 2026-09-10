/**
 * Quién llama y desde qué pantalla, para que una pantalla de este portal pueda pasar de «existe en
 * el código» a «alguien la usó».
 *
 * El backend del Motor guarda `x-atlas-flow` y `x-atlas-product` junto a cada acceso auditado, y
 * Flujos lo cruza con su catálogo de pantallas. `motor-portal` se normaliza a `MOTOR_PORTAL`, el
 * código del catálogo.
 *
 * ## Por qué se lee al ENVIAR y de `window.location`
 *
 * Un estado que fijara un efecto llegaría tarde: React ejecuta los efectos de los hijos antes que
 * los del padre, y la primera carga de una pantalla nueva saldría con la ruta de la anterior. El App
 * Router actualiza el historial en un `useInsertionEffect`, que corre antes que cualquier efecto de
 * la pantalla, así que cuando ésta pide sus datos la URL ya es la suya.
 *
 * Va la ruta CONCRETA (`/approval-requests/42`): la plantilla la resuelve quien tiene el catálogo.
 * En el servidor no hay pantalla, y no se inventa una.
 */
export const ATLAS_PRODUCT = 'motor-portal';

/** El formato que aceptan el backend del Motor y AtlasBackend; lo que no encaje no se manda. */
const RUTA_DE_PANTALLA = /^\/[A-Za-z0-9/_:.-]{0,199}$/;

type Ubicacion = { pathname: string } | null;

/** La ubicación del navegador, o nula en el servidor. */
function ubicacionActual(): Ubicacion {
  return typeof window === 'undefined' ? null : window.location;
}

export function pantallaDeOrigen(ubicacion: Ubicacion): string | null {
  if (!ubicacion) return null;
  return RUTA_DE_PANTALLA.test(ubicacion.pathname) ? ubicacion.pathname : null;
}

/** Pone las cabeceras de origen sin pisar las que ya traiga la petición. */
export function setOriginHeaders(headers: Headers, ubicacion: Ubicacion = ubicacionActual()): void {
  if (!headers.has('x-atlas-product')) headers.set('x-atlas-product', ATLAS_PRODUCT);
  const pantalla = pantallaDeOrigen(ubicacion);
  if (pantalla && !headers.has('x-atlas-flow')) headers.set('x-atlas-flow', pantalla);
}
