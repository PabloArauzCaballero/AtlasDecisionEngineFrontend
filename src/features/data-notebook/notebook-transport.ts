import { z } from 'zod';

/**
 * Cómo se habla con AtlasBackend desde el cuaderno: la raíz y el sobre.
 *
 * Vive aparte porque lo comparten los dos clientes —el de datasets y el de
 * documentos, separados al pasar `notebook.api.ts` del límite de 299 líneas del
 * repositorio— y duplicarlo era garantizar que un día dejaran de coincidir.
 */

/**
 * Todo cuelga de `/atlas-backend/*`, que es el proxy del portal hacia AtlasBackend. No es `/v1/*`
 * a propósito: ese prefijo es del motor de decisión y el gate de superficie lo interpreta como tal.
 */
export const BASE = '/atlas-backend/data-notebook';

/**
 * AtlasBackend envuelve TODA respuesta en `{ requestId, data, timestamp }`. El motor no.
 *
 * Es la diferencia que dejó el cuaderno en blanco con el mensaje «No fue posible leer el catálogo»:
 * los esquemas describían el contenido y la respuesta traía el sobre, así que la validación fallaba
 * siempre — contra el backend real, y sólo contra él.
 *
 * No lo detectó nada, y merece la pena entender por qué: las pruebas E2E simulaban esta API con el
 * objeto PELADO, o sea con una forma que el backend nunca devuelve, así que verificaban que la
 * pantalla sabe pintar algo que no existe. Y las comprobaciones con `curl` leían el JSON a ojo, sin
 * pasar por el cliente. Veintiuna pruebas en verde sobre un camino que nunca funcionó.
 *
 * Se admite también la forma pelada porque el `requestId` no es obligatorio en todas las rutas y
 * porque un backend que un día deje de envolver no debería vaciar la pantalla.
 */
export function sobre<S extends z.ZodTypeAny>(esquema: S) {
  return z.preprocess(
    (cuerpo) =>
      cuerpo && typeof cuerpo === 'object' && 'data' in cuerpo
        ? (cuerpo as { data: unknown }).data
        : cuerpo,
    esquema,
  );
}
