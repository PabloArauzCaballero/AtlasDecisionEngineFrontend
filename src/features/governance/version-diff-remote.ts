import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { COLLECTIONS, describirCambios, type GraphDiff } from './version-diff';

/**
 * La comparación la decide el MOTOR; aquí sólo se explica su respuesta.
 *
 * El portal calculaba su propio diff a partir de los dos grafos, y el motor publicaba
 * `GET /v1/artifact-versions/{izq}/diff/{der}` sin que nadie lo llamara. La exención lo nombraba
 * sin rodeos: «deuda real: dos implementaciones del mismo diff que pueden discrepar». En un
 * artefacto de gobierno, dos respuestas distintas a «qué cambió» es peor que ninguna — porque
 * las dos parecen autoritativas y no hay forma de saber cuál mentía.
 *
 * La salida NO fue borrar el código del cliente sin más, y la razón importa: el motor compara a
 * nivel de ENTIDAD (añadida, quitada, cambiada, con su `before` y su `after`), mientras que la
 * pantalla de revisión enseña el detalle CAMPO A CAMPO y separa lo cosmético de lo que altera
 * la decisión. Sustituir lo segundo por lo primero habría cambiado un problema de coherencia
 * por uno de información: el revisor vería «este nodo cambió» sin saber si se movió de sitio o
 * si se le cambió el umbral.
 *
 * El reparto que queda es el correcto:
 *
 * - **Qué cambió lo decide el motor.** Es quien tiene la verdad canónica y quien calcula los
 *   checksums; el portal ya no vuelve a decidirlo por su cuenta.
 * - **Cómo se explica lo hace el portal**, y sobre el `before`/`after` que el motor entregó.
 *   Eso es formatear una respuesta, no emitir una segunda opinión: sobre los mismos dos objetos
 *   no puede salir un veredicto distinto.
 */

/** Un elemento cambiado, tal como lo publica el motor. */
interface CambioRemoto {
  before?: unknown;
  after?: unknown;
}

function identificadorDe(fila: UnknownRecord, idFields: readonly string[]): string {
  for (const campo of idFields) {
    const valor = fila[campo];
    if (valor !== undefined && valor !== null && String(valor) !== '') return String(valor);
  }
  return '';
}

/**
 * Convierte la respuesta del motor en las entradas que pinta la pantalla.
 *
 * Se recorren las mismas colecciones que el catálogo local declara, y en su orden: así el
 * agrupado por colección sigue funcionando y una colección que el motor no compare simplemente
 * no aparece, en vez de aparecer vacía y sugerir que se comparó y no había nada.
 */
export function adaptarDiffDelMotor(payload: unknown): GraphDiff {
  const raiz = asRecord(payload);
  const bloques: { spec: (typeof COLLECTIONS)[number]; datos: UnknownRecord }[] = [];

  for (const spec of COLLECTIONS) {
    const bloque = raiz[spec.key];
    if (bloque && typeof bloque === 'object') bloques.push({ spec, datos: asRecord(bloque) });
  }

  const entradas = bloques.flatMap(({ spec, datos }) => {
    const anadidos = asRows(datos.added);
    const quitados = asRows(datos.removed);
    const cambiados = (Array.isArray(datos.changed) ? datos.changed : []) as CambioRemoto[];

    return describirCambios(spec, {
      added: anadidos.map((fila) => ({
        id: identificadorDe(fila, spec.idFields),
        valor: fila,
      })),
      removed: quitados.map((fila) => ({
        id: identificadorDe(fila, spec.idFields),
        valor: fila,
      })),
      changed: cambiados.map((cambio) => {
        const antes = asRecord(cambio.before);
        const despues = asRecord(cambio.after);
        return {
          // El identificador se busca en cualquiera de los dos lados: un elemento renombrado
          // sigue siendo el mismo elemento, y quedarse sólo con `after` perdería el de un
          // cambio que borra el campo identificador.
          id: identificadorDe(despues, spec.idFields) || identificadorDe(antes, spec.idFields),
          antes,
          despues,
        };
      }),
    });
  });

  const counts = { added: 0, removed: 0, changed: 0 };
  for (const cambio of entradas) counts[cambio.kind] += 1;

  return {
    entries: entradas,
    substantive: entradas.filter((cambio) => !cambio.cosmetic),
    counts,
    // «Sin colecciones comparables» es distinto de «sin cambios»: lo primero significa que el
    // motor no devolvió nada que comparar, y merece decirse de otra manera.
    empty: bloques.length === 0,
  };
}
