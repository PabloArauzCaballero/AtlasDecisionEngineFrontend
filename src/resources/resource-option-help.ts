/**
 * Qué significa cada valor de los dominios cerrados que se filtran en los
 * listados, y cuándo elegirlo.
 *
 * Los estados llegaban del backend como el código en crudo —`SUPERSEDED`,
 * `CHANGES_REQUESTED`— y el filtro era una lista de palabras a adivinar: para
 * saber qué acotaba «COMPILED» había que elegirlo y mirar qué desaparecía. Aquí
 * se escribe una vez, y `withDescriptions` lo cose con las etiquetas.
 */
import type { OptionDescriptions } from '../contracts/option';

/** Estado del ciclo de vida de una VERSIÓN de artefacto (F2). */
export const ARTIFACT_STATUS_HELP: OptionDescriptions = {
  DRAFT: 'Se está escribiendo: se puede editar y no decide nada todavía.',
  VALIDATION_FAILED: 'La validación encontró errores; hay que corregir antes de seguir.',
  VALIDATED: 'Pasó la validación estructural; aún no se ha compilado.',
  COMPILED: 'Compilada y lista para pedir aprobación; todavía no la ha visto nadie.',
  IN_REVIEW: 'Esperando la firma de dos aprobadores del portal de gobierno.',
  CHANGES_REQUESTED: 'Un aprobador pidió cambios; vuelve a manos de quien la escribe.',
  APPROVED: 'Aprobada por gobierno y en condiciones de desplegarse.',
  DEPLOYED_TO_DEV: 'Publicada en desarrollo, para probar con datos de juguete.',
  DEPLOYED_TO_STAGING: 'Publicada en preproducción, contra datos parecidos a los reales.',
  DEPLOYED_TO_TEST: 'Publicada en el ambiente de pruebas del equipo de calidad.',
  DEPLOYED_TO_PROD: 'Decidiendo casos reales de clientes en este momento.',
  SUSPENDED: 'Detenida a mano en todos sus ambientes; no decide hasta reactivarla.',
  REJECTED: 'Gobierno la rechazó; no puede desplegarse y habrá que crear otra versión.',
  RETIRED: 'Retirada de circulación; se conserva sólo para poder auditarla.',
};

/** Resultado de una promoción a un ambiente (F4). */
export const DEPLOYMENT_STATUS_HELP: OptionDescriptions = {
  PREPARING: 'La promoción está en marcha y todavía no atiende tráfico.',
  ACTIVE: 'Es la versión que el ambiente está usando ahora mismo.',
  SUSPENDED: 'Publicada pero detenida a mano; no recibe decisiones.',
  SUPERSEDED: 'Otra promoción posterior la reemplazó en ese ambiente.',
  ROLLED_BACK: 'Se revirtió a la versión anterior tras publicarla.',
  FAILED: 'La promoción no llegó a completarse y el ambiente no cambió.',
};

/** Estado de un caso en la cola de revisión manual (F5). */
export const MANUAL_REVIEW_STATUS_HELP: OptionDescriptions = {
  OPEN: 'Nadie lo ha tomado todavía; está esperando a que alguien lo reclame.',
  ASSIGNED: 'Alguien lo reclamó y es quien puede resolverlo.',
  RESOLVED_APPROVED: 'Una persona lo revisó y aprobó la solicitud.',
  RESOLVED_DECLINED: 'Una persona lo revisó y rechazó la solicitud.',
  CANCELLED: 'Se cerró sin decidir: el caso dejó de tener sentido.',
};

/** Desenlace de una ejecución del motor, tal como lo registra la auditoría. */
export const EXECUTION_OUTCOME_HELP: OptionDescriptions = {
  APPROVED: 'El motor resolvió a favor sin intervención de nadie.',
  DECLINED: 'El motor resolvió en contra con los motivos que adjuntó.',
  MANUAL_REVIEW: 'El motor no decidió y derivó el caso a una persona.',
};

/** Sentido de una variable dentro de los algoritmos que la usan. */
export const VARIABLE_USAGE_HELP: OptionDescriptions = {
  INPUT: 'Dato que hay que aportar en la petición para poder decidir.',
  OUTPUT: 'Resultado que el motor produce y devuelve al terminar.',
};

/** De dónde se espera que llegue el valor de una variable (`expectedOrigin`). */
export const EXPECTED_ORIGIN_HELP: OptionDescriptions = {
  REQUEST: 'Viene en la petición que abre la decisión; lo aporta quien llama.',
  PROVIDER: 'Lo resuelve un proveedor externo (buró, listas, verificación).',
  DERIVED: 'Se calcula a partir de otras variables ya presentes.',
  CALCULATED_FIELD: 'Lo produce un campo calculado del catálogo, con su propia fórmula.',
  GRAPH_NODE: 'Lo escribe un nodo del grafo durante la propia ejecución.',
};
