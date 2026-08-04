import type { EnvironmentHead } from './environment-heads';
import type { DiffBase } from './VersionDiffPanel';

interface BuildDiffBasesInput {
  /** Versión bajo revisión. Nunca se compara contra sí misma. */
  versionId: string;
  /** Versión de la que partió, si el backend la declara (`sourceVersionId`). */
  sourceVersionId: string | null;
  heads: EnvironmentHead[];
}

export interface DiffBasesResult {
  bases: DiffBase[];
  /**
   * Ambientes cuya versión vigente NO es la base de la que partió esta.
   *
   * Es el escenario del §6.1 del encargo: la propuesta se creó sobre una versión
   * y, mientras esperaba revisión, el objetivo avanzó. Aquí no se puede resolver
   * —no hay endpoint de merge— pero sí advertirlo y ofrecer la comparación
   * contra lo que de verdad está decidiendo hoy.
   */
  movedAhead: EnvironmentHead[];
}

function valid(id: string | null | undefined, exclude: string): id is string {
  return Boolean(id) && id !== '—' && id !== exclude;
}

/**
 * Arma las referencias contra las que tiene sentido comparar una versión: su
 * origen y lo vigente en cada ambiente.
 */
export function buildDiffBases({
  versionId,
  sourceVersionId,
  heads,
}: BuildDiffBasesInput): DiffBasesResult {
  const bases: DiffBase[] = [];
  const seen = new Set<string>();

  if (valid(sourceVersionId, versionId)) {
    bases.push({
      versionId: sourceVersionId,
      label: 'Versión de origen',
      hint: 'de la que partió esta',
    });
    seen.add(sourceVersionId);
  }

  for (const head of heads) {
    if (!valid(head.versionId, versionId) || seen.has(head.versionId)) continue;
    bases.push({
      versionId: head.versionId,
      label: `Vigente en ${head.environmentCode}`,
      hint: `v${head.versionLabel}`,
    });
    seen.add(head.versionId);
  }

  const movedAhead = heads.filter(
    (head) =>
      valid(head.versionId, versionId) &&
      sourceVersionId !== null &&
      head.versionId !== sourceVersionId,
  );

  return { bases, movedAhead };
}
