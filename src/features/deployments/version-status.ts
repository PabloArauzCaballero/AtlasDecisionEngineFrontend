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
