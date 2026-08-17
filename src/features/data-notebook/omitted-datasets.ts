import type { OmittedRelation } from '../sql-console/sql-console.types';
import type { NotebookCatalog } from './notebook.api';

/**
 * Lo que cada backend descubrió y decidió NO servir, unido y con el origen delante.
 *
 * Los dos catálogos se descubren solos contra el catálogo de su base, así que ninguno necesita un
 * despliegue para publicar una vista nueva. El precio de eso es un estado intermedio que antes no
 * podía darse: una vista que está en la base y que su backend rechaza —porque no hay por dónde
 * acotar el inquilino—. Sin enseñarlo, ese caso es indistinguible de una vista que nadie creó, y
 * quien la publicó se queda sin nada que mirar.
 *
 * El origen va delante porque las dos mitades no se arreglan en el mismo repositorio: una vista de
 * `read_api` la corrige AtlasBackend y una de `riesgo` el motor. Sin esa palabra, la lista dice
 * qué está mal y no a quién decírselo.
 *
 * Los dos backends nombran su relación en un campo distinto —`view` uno, `name` el otro— y aquí se
 * unifican en vez de forzarles un contrato común: son dos APIs con dueños distintos y hacer que
 * coincidan en la forma sería acoplarlas por una lista que el portal ya sabe traducir.
 */
export function unirDescartadas(
  backend: NotebookCatalog | undefined,
  motor: { omitted: OmittedRelation[] } | undefined,
): OmittedRelation[] {
  return [
    ...(backend?.omitted ?? []).map((entrada) => ({
      name: `AtlasBackend · ${entrada.view}`,
      reason: entrada.reason,
    })),
    ...(motor?.omitted ?? []).map((entrada) => ({
      name: `Motor de decisión · ${entrada.name}`,
      reason: entrada.reason,
    })),
  ];
}
