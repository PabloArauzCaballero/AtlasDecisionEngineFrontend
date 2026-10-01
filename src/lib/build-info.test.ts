import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadServedIdentity,
  parseBuildInfo,
  resolveServedIdentity,
  UNKNOWN_COMMIT,
} from './build-info';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const envWith = (extra: Record<string, string>): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  ...extra,
});
const script = join(process.cwd(), 'scripts', 'write-build-info.mjs');

describe('identidad del build (PLAT-03)', () => {
  it('OP-01 sin commit en el artefacto ni en runtime NO inventa uno: unknown', () => {
    expect(resolveServedIdentity({ commit: null, builtAt: null }, undefined).commit).toBe(
      UNKNOWN_COMMIT,
    );
    expect(resolveServedIdentity({ commit: null, builtAt: null }, '').commit).toBe(UNKNOWN_COMMIT);
  });

  it('OP-06 la variable de runtime vacía, mal formada o contradictoria NO suplanta el commit compilado', () => {
    const build = { commit: sha, builtAt: '2026-10-01T00:00:00.000Z' };
    for (const runtime of [undefined, '', 'local', other, sha.slice(0, 7)]) {
      expect(resolveServedIdentity(build, runtime).commit).toBe(sha);
    }
  });

  it('el runtime sólo rellena si el artefacto no trae commit y es un SHA completo', () => {
    expect(resolveServedIdentity({ commit: null, builtAt: null }, other).commit).toBe(other);
    expect(resolveServedIdentity({ commit: null, builtAt: null }, 'local').commit).toBe(
      UNKNOWN_COMMIT,
    );
  });

  it('parseBuildInfo rechaza JSON inválido, commit corto y fecha que no es ISO', () => {
    expect(parseBuildInfo('no-json')).toEqual({ commit: null, builtAt: null });
    expect(parseBuildInfo(JSON.stringify({ commit: 'abc', builtAt: 'ayer' }))).toEqual({
      commit: null,
      builtAt: null,
    });
    expect(
      parseBuildInfo(JSON.stringify({ commit: sha, builtAt: '2026-10-01T00:00:00Z' })).commit,
    ).toBe(sha);
  });

  it('el script escribe el artefacto y loadServedIdentity lo lee (build → /version)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bi-'));
    const out = join(dir, 'build-info.json');
    execFileSync(process.execPath, [script, out], {
      env: { ...process.env, SOURCE_COMMIT: sha },
      cwd: dir,
    });
    const served = loadServedIdentity(
      envWith({
        BUILD_INFO_PATH: out,
        APP_COMMIT_SHA: other,
      }),
    );
    expect(served.commit).toBe(sha);
    expect(served.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sin SOURCE_COMMIT el script lee .git (HEAD, ref suelto y packed-refs) sin el binario git', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bi-git-'));
    mkdirSync(join(dir, '.git', 'refs', 'heads'), { recursive: true });
    writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/dev\n');
    writeFileSync(join(dir, '.git', 'refs', 'heads', 'dev'), `${sha}\n`);
    const env = { ...process.env, SOURCE_COMMIT: '' };
    execFileSync(process.execPath, [script, 'a.json'], { env, cwd: dir });
    expect(loadServedIdentity(envWith({ BUILD_INFO_PATH: join(dir, 'a.json') })).commit).toBe(sha);

    const packed = mkdtempSync(join(tmpdir(), 'bi-packed-'));
    mkdirSync(join(packed, '.git'), { recursive: true });
    writeFileSync(join(packed, '.git', 'HEAD'), 'ref: refs/heads/dev\n');
    writeFileSync(join(packed, '.git', 'packed-refs'), `# pack-refs\n${other} refs/heads/dev\n`);
    execFileSync(process.execPath, [script, 'b.json'], { env, cwd: packed });
    expect(loadServedIdentity(envWith({ BUILD_INFO_PATH: join(packed, 'b.json') })).commit).toBe(
      other,
    );
  });

  it('sin SOURCE_COMMIT ni .git el script NO falla el build y deja commit null', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bi-none-'));
    execFileSync(process.execPath, [script, 'c.json'], {
      env: { ...process.env, SOURCE_COMMIT: '' },
      cwd: dir,
    });
    expect(loadServedIdentity(envWith({ BUILD_INFO_PATH: join(dir, 'c.json') })).commit).toBe(
      UNKNOWN_COMMIT,
    );
  });
});

describe('el Dockerfile lleva la identidad dentro del artefacto', () => {
  const dockerfile = readFileSync('Dockerfile', 'utf8');
  it('recibe SOURCE_COMMIT como build-arg, escribe build-info.json ANTES de compilar y lo copia a la imagen final', () => {
    expect(dockerfile).toMatch(/ARG SOURCE_COMMIT/);
    expect(dockerfile.indexOf('write-build-info.mjs')).toBeGreaterThan(0);
    expect(dockerfile.indexOf('write-build-info.mjs')).toBeLessThan(
      dockerfile.indexOf('RUN yarn build'),
    );
    expect(dockerfile).toMatch(/COPY --from=builder[^\n]*\/app\/build-info\.json/);
  });
  it('el .dockerignore deja pasar .git/HEAD, packed-refs y refs aunque excluya .git', () => {
    const ignore = readFileSync('.dockerignore', 'utf8');
    expect(ignore).toMatch(/^\.git$/m);
    for (const entry of ['!.git/HEAD', '!.git/packed-refs', '!.git/refs'])
      expect(ignore).toContain(entry);
  });
});
