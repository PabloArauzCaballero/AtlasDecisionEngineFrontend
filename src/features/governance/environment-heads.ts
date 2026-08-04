import { display, resolvePath, type UnknownRecord } from '../../utils/records';

/**
 * Versión vigente («head») de un artefacto en cada ambiente.
 *
 * La ficha del artefacto llamaba «Current Version» a `versions[0]`, la más
 * reciente del historial, y la etiquetaba «Governed». Eso no es lo que está
 * decidiendo en producción: la versión vigente en un ambiente es la del último
 * despliegue ACTIVE ahí. Una versión recién creada aparecía como si mandara.
 *
 * El portal no puede *imponer* «una sola versión activa por ambiente» —eso vive
 * en la base del backend—, pero sí puede dejar de esconder la violación: si un
 * ambiente devuelve más de un despliegue activo, se cuenta y se muestra.
 */

const ACTIVE_STATUSES = new Set(['ACTIVE', 'DEPLOYED', 'LIVE']);

export interface EnvironmentHead {
  environmentCode: string;
  versionLabel: string;
  versionId: string | null;
  deployedAt: string;
  deployedBy: string;
  /** Despliegues activos en ese ambiente. Más de uno rompe la invariante. */
  activeCount: number;
}

function nullable(value: unknown): string | null {
  const text = value === null || value === undefined ? '' : String(value);
  return text.trim() ? text : null;
}

function isActive(row: UnknownRecord): boolean {
  const status = String(row.deploymentStatus ?? row.status ?? '')
    .trim()
    .toUpperCase();
  return ACTIVE_STATUSES.has(status);
}

/** Milisegundos de la fecha de despliegue; lo ilegible va al final. */
function deployedTime(row: UnknownRecord): number {
  const parsed = Date.parse(String(row.deployedAt ?? ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Agrupa los despliegues activos por ambiente y devuelve el más reciente de
 * cada uno, junto con cuántos activos había.
 */
export function deriveEnvironmentHeads(deployments: UnknownRecord[]): EnvironmentHead[] {
  const byEnvironment = new Map<string, UnknownRecord[]>();
  for (const row of deployments) {
    if (!isActive(row)) continue;
    const code = nullable(resolvePath(row, 'environment.code') ?? row.environmentCode);
    if (!code) continue;
    const bucket = byEnvironment.get(code);
    if (bucket) bucket.push(row);
    else byEnvironment.set(code, [row]);
  }

  return [...byEnvironment.entries()]
    .map(([environmentCode, rows]) => {
      const newest = rows.reduce((latest, row) =>
        deployedTime(row) > deployedTime(latest) ? row : latest,
      );
      return {
        environmentCode,
        versionLabel: String(
          resolvePath(newest, 'artifactVersion.semanticVersion') ??
            resolvePath(newest, 'artifactVersion.versionNumber') ??
            '—',
        ),
        versionId: nullable(resolvePath(newest, 'artifactVersion.id')),
        deployedAt: display(newest, 'deployedAt'),
        deployedBy: display(newest, 'deployedBy'),
        activeCount: rows.length,
      };
    })
    .sort((a, b) => a.environmentCode.localeCompare(b.environmentCode));
}

/** Ambientes con la invariante rota: más de una versión activa a la vez. */
export function conflictingHeads(heads: EnvironmentHead[]): EnvironmentHead[] {
  return heads.filter((head) => head.activeCount > 1);
}
