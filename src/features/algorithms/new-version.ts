/**
 * Crear una versión nueva de un algoritmo: qué se pide y cuándo se puede editar la que hay.
 *
 * Una versión publicada es inmutable. Cambiar un algoritmo es SIEMPRE clonar una versión a un borrador nuevo
 * (`POST /v1/artifact-versions/{id}/clone`), editar ese borrador y llevarlo otra vez a validación, pruebas,
 * revisión y despliegue. Hasta 2026-10 esa acción sólo existía dentro de «Importar código»; el tutorial decía
 * «Algoritmos → tu algoritmo → Nueva versión» y ese botón no estaba en ninguna parte.
 */

/** Estados en los que el editor todavía puede escribir sobre la versión (el motor rechaza el resto). */
const EDITABLE_STATUSES = new Set(['DRAFT', 'VALIDATION_FAILED', 'VALIDATED']);

export function isEditableVersionStatus(status: unknown): boolean {
  return typeof status === 'string' && EDITABLE_STATUSES.has(status.toUpperCase());
}

/** `2.1.0` → `2.2.0`. Lo que no sea `mayor.menor.parche` no se adivina: se deja vacío y lo numera el motor. */
export function suggestNextSemanticVersion(current: unknown): string {
  const match = typeof current === 'string' ? /^(\d+)\.(\d+)\.(\d+)$/.exec(current.trim()) : null;
  if (!match) return '';
  return `${match[1]}.${String(Number(match[2]) + 1)}.0`;
}

export const CHANGE_SUMMARY_MIN_LENGTH = 10;
const SEMANTIC_VERSION = /^\d+\.\d+\.\d+$/;

export interface NewVersionDraft {
  changeSummary: string;
  semanticVersion: string;
}

/** El motivo por el que todavía no se puede crear, o `null` si ya se puede. */
export function newVersionBlocker(draft: NewVersionDraft): string | null {
  if (draft.changeSummary.trim().length < CHANGE_SUMMARY_MIN_LENGTH) {
    return `Cuenta qué cambia en al menos ${String(CHANGE_SUMMARY_MIN_LENGTH)} caracteres: es lo que leerán quienes la aprueben.`;
  }
  const version = draft.semanticVersion.trim();
  if (version && !SEMANTIC_VERSION.test(version)) {
    return 'El número de versión va como 2.3.0 (mayor.menor.parche), o vacío para que lo numere el motor.';
  }
  return null;
}

/** El cuerpo que acepta `CloneVersionDto`: el número sólo viaja si se escribió. */
export function toClonePayload(draft: NewVersionDraft): {
  changeSummary: string;
  semanticVersion?: string;
} {
  const version = draft.semanticVersion.trim();
  return version
    ? { changeSummary: draft.changeSummary.trim(), semanticVersion: version }
    : { changeSummary: draft.changeSummary.trim() };
}
