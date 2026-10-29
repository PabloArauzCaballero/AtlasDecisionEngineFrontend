import { display, type UnknownRecord } from '../../utils/records';

/**
 * Completa el `id` de cada motivo de una acción a partir de su código.
 *
 * El formulario de acciones sólo conoce el CÓDIGO del motivo («FRAUDE_ALTO»), pero el motor guarda
 * el grafo con el identificador del catálogo. `snapshotToEditableGraph` lo convertía con
 * `String(reason.id)`, y para una acción NUEVA —sin id— salía el texto «undefined»: el servidor
 * respondía 400 `reasonCodeId must match /^[1-9]\d{0,18}$/` y la acción no se podía guardar
 * (QA 2026-10-29, BUG-7). Tampoco traen prioridad (`Number(undefined)` = NaN, y el servidor exige ≥ 1):
 * se les da su orden. Lo que ya trae id y prioridad se conserva tal cual.
 */
export async function resolverMotivos(
  acciones: readonly UnknownRecord[],
  buscar: (codigo: string) => Promise<string | null>,
): Promise<UnknownRecord[]> {
  // Se guarda la PROMESA: dos acciones con el mismo motivo en paralelo consultan una sola vez.
  const cache = new Map<string, Promise<string>>();
  const resolver = (codigo: string): Promise<string> => {
    const guardado = cache.get(codigo);
    if (guardado) return guardado;
    const pendiente = buscar(codigo).then((id) => {
      if (!id)
        throw new Error(
          `El motivo «${codigo}» no existe en el catálogo de motivos: créalo antes de usarlo en una acción.`,
        );
      return id;
    });
    cache.set(codigo, pendiente);
    return pendiente;
  };

  return Promise.all(
    acciones.map(async (accion) => {
      const motivos = Array.isArray(accion.reasonCodes)
        ? (accion.reasonCodes as UnknownRecord[])
        : [];
      const completo = (motivo: UnknownRecord) =>
        motivo.id !== undefined &&
        motivo.id !== null &&
        motivo.priority !== undefined &&
        motivo.priority !== null;
      if (motivos.every(completo)) return accion;
      const completos = await Promise.all(
        motivos.map(async (motivo, indice) => ({
          ...motivo,
          // Un motivo nuevo no trae prioridad: `Number(undefined)` salía NaN y el servidor exige ≥ 1.
          priority: motivo.priority ?? indice + 1,
          id: motivo.id ?? (await resolver(display(motivo, 'code', 'reasonCode'))),
        })),
      );
      return { ...accion, reasonCodes: completos };
    }),
  );
}
