import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Identidad del artefacto que está sirviendo tráfico (PLAT-03).
 *
 * La autoridad es `build-info.json`, escrito UNA vez durante el build de la imagen
 * (`scripts/write-build-info.mjs`) y copiado dentro de ella. `APP_COMMIT_SHA` (variable de runtime) sólo
 * rellena cuando el artefacto no trae commit; nunca lo sustituye ni lo contradice. Antes el commit
 * dependía de que Coolify inyectara `SOURCE_COMMIT` al arrancar: una variable vacía o ausente salía como
 * `"commit": ""` / `"unknown"` y un servicio sano quedaba sin identidad.
 */
const COMMIT_SHA = /^[0-9a-f]{40}$/;
export const UNKNOWN_COMMIT = 'unknown';

export interface BuildInfo {
  commit: string | null;
  builtAt: string | null;
}

export interface ServedIdentity {
  commit: string;
  builtAt: string | null;
}

export const isCommitSha = (value: unknown): value is string =>
  typeof value === 'string' && COMMIT_SHA.test(value);

const isIsoInstant = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  !Number.isNaN(Date.parse(value));

export function parseBuildInfo(raw: string): BuildInfo {
  try {
    const parsed: unknown = JSON.parse(raw);
    const record =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    return {
      commit: isCommitSha(record.commit) ? record.commit : null,
      builtAt: isIsoInstant(record.builtAt) ? record.builtAt : null,
    };
  } catch {
    return { commit: null, builtAt: null };
  }
}

/** El artefacto manda: el commit de runtime sólo vale si el build no trae uno, y un SHA mal formado no vale. */
export function resolveServedIdentity(
  build: BuildInfo,
  runtimeCommit: string | undefined,
): ServedIdentity {
  if (build.commit) return { commit: build.commit, builtAt: build.builtAt };
  const runtime = runtimeCommit?.trim();
  return { commit: isCommitSha(runtime) ? runtime : UNKNOWN_COMMIT, builtAt: build.builtAt };
}

export function loadServedIdentity(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): ServedIdentity {
  const path = env.BUILD_INFO_PATH ?? resolve(cwd, 'build-info.json');
  let build: BuildInfo;
  try {
    build = parseBuildInfo(readFileSync(path, 'utf8'));
  } catch {
    build = { commit: null, builtAt: null };
  }
  return resolveServedIdentity(build, env.APP_COMMIT_SHA);
}
