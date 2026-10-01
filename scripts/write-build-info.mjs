#!/usr/bin/env node
/**
 * Escribe `build-info.json` con el commit compilado y el instante del build (PLAT-03).
 *
 * Se ejecuta en la etapa de build de la imagen, ANTES de `next build`, y el archivo viaja dentro del
 * artefacto: `/version` lo lee de ahí. El commit sale, por este orden, de:
 *   1. el argumento de build `SOURCE_COMMIT` (Coolify lo define) si es un SHA de 40 hex;
 *   2. el `.git` del contexto de build (HEAD, ref suelto o packed-refs), sin el binario git.
 * Si ninguno da un SHA válido escribe `commit: null` y NO falla el build: la identidad no se inventa y
 * el smoke de release rechaza un servicio cuyo commit no coincide con el candidato.
 *
 *   node scripts/write-build-info.mjs [salida]     (por defecto ./build-info.json)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const isCommitSha = (value) => typeof value === 'string' && COMMIT_SHA.test(value);

export function readCommitFromGitDir(gitDir) {
  try {
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
    if (isCommitSha(head)) return head;
    const ref = /^ref:\s*(\S+)$/.exec(head)?.[1];
    if (!ref) return null;
    try {
      const loose = readFileSync(join(gitDir, ref), 'utf8').trim();
      if (isCommitSha(loose)) return loose;
    } catch {
      // el ref puede estar sólo en packed-refs
    }
    for (const line of readFileSync(join(gitDir, 'packed-refs'), 'utf8').split('\n')) {
      const [sha, name] = line.trim().split(' ');
      if (name === ref && isCommitSha(sha)) return sha;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildInfo(env = process.env, gitDir = resolve('.git'), now = new Date()) {
  const fromArg = env.SOURCE_COMMIT?.trim();
  return {
    commit: isCommitSha(fromArg) ? fromArg : readCommitFromGitDir(gitDir),
    builtAt: now.toISOString(),
  };
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  const out = resolve(process.argv[2] ?? 'build-info.json');
  const info = buildInfo();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(info, null, 2)}\n`);
  console.log(
    `build-info: commit=${info.commit ?? 'NO DETERMINADO'} builtAt=${info.builtAt} -> ${out}`,
  );
}
