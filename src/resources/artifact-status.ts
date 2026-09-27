/**
 * El estado de una versión de artefacto, para leerlo en un selector.
 *
 * Vive aparte de `resource-option-help.ts` porque allí cada mapa es una EXPLICACIÓN de cada
 * valor (y una prueba lo exige); esto son nombres cortos y la regla de qué se puede probar.
 */
/** Nombre corto, en español, de cada estado de una versión: lo que se lee en un selector. */
export const ARTIFACT_STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: 'Borrador',
  VALIDATION_FAILED: 'Validación con errores',
  VALIDATED: 'Validada',
  COMPILED: 'Compilada',
  IN_REVIEW: 'En revisión',
  CHANGES_REQUESTED: 'Con cambios pedidos',
  APPROVED: 'Aprobada',
  DEPLOYED_TO_DEV: 'Desplegada en desarrollo',
  DEPLOYED_TO_STAGING: 'Desplegada en preproducción',
  DEPLOYED_TO_TEST: 'Desplegada en pruebas',
  DEPLOYED_TO_PROD: 'Desplegada en producción',
  SUSPENDED: 'Suspendida',
  REJECTED: 'Rechazada',
  RETIRED: 'Retirada',
};

/**
 * Estados en los que la versión todavía NO tiene artefacto compilado. Todo lo demás pasó por
 * la compilación (revisión, aprobación y despliegue la exigen), así que se puede probar.
 */
export const UNCOMPILED_STATUSES: ReadonlySet<string> = new Set([
  'DRAFT',
  'VALIDATION_FAILED',
  'VALIDATED',
]);
