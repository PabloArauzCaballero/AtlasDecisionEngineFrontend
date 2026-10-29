/**
 * Qué estados de versión admite cada operación del motor. Los selectores ofrecían TODAS las
 * versiones y el servidor rechazaba la mayoría (QA 2026-10-29, OBS-28):
 *
 * - desplegar (`VersionApprovalGate`): APPROVED o cualquier DEPLOYED_TO_* (promover a otro ambiente);
 * - cambiar el grafo o sus acciones (`VERSION_IMMUTABLE`): sólo DRAFT o VALIDATION_FAILED.
 */
const DESPLEGABLES = new Set([
  'APPROVED',
  'DEPLOYED_TO_DEV',
  'DEPLOYED_TO_TEST',
  'DEPLOYED_TO_STAGING',
  'DEPLOYED_TO_PROD',
]);

const EDITABLES = new Set(['DRAFT', 'VALIDATION_FAILED']);

const normalizar = (estado: unknown) =>
  String(estado ?? '')
    .trim()
    .toUpperCase();

export const esVersionDesplegable = (estado: unknown): boolean =>
  DESPLEGABLES.has(normalizar(estado));

export const esVersionEditable = (estado: unknown): boolean => EDITABLES.has(normalizar(estado));

export interface VersionCargada {
  readonly id: string;
  readonly status: string;
}

/**
 * Por qué el editor de grafos no puede validar ni guardar ahora, o `null` si puede.
 *
 * Sin la versión CARGADA no hay `lockVersion` (viaja `If-Match: 0` y el servidor responde 400
 * `INVALID_IF_MATCH`), y una versión que no es borrador es inmutable (409 `VERSION_IMMUTABLE`):
 * los botones estaban encendidos y devolvían el error en crudo (QA 2026-10-29, OBS-17).
 */
export function motivoSinEdicion(versionId: string, cargada: VersionCargada | null): string | null {
  if (!versionId) return null; // ya lo explica «Elige primero un algoritmo y una versión»
  if (!cargada || cargada.id !== versionId)
    return 'Pulsa «Cargar» para traer la versión antes de validarla o guardarla.';
  if (!esVersionEditable(cargada.status)) {
    return `Esta versión está «${cargada.status}»: sólo los borradores se pueden modificar. Crea una versión nueva en borrador.`;
  }
  return null;
}
