import { describe, expect, it } from 'vitest';
import { resolveEnvironmentLabel } from './environment-label';

describe('resolveEnvironmentLabel', () => {
  it('manda la variable de ejecución sobre todo lo demás', () => {
    expect(
      resolveEnvironmentLabel({ runtimeLabel: 'staging', host: 'x.test.y.com', bakedLabel: 'DEV' }),
    ).toBe('STAGING');
  });

  it('un host de TEST dice TEST aunque la imagen se horneara con DEV', () => {
    expect(
      resolveEnvironmentLabel({
        host: 'atlas.decisionengine.test.arauzsoftware.com',
        bakedLabel: 'DEV',
      }),
    ).toBe('TEST');
  });

  it('no confunde un nombre que sólo contiene «test» dentro de otra palabra', () => {
    expect(resolveEnvironmentLabel({ host: 'contest.example.com:443', bakedLabel: 'DEV' })).toBe(
      'DEV',
    );
  });

  it('sin nada declarado no inventa un ambiente', () => {
    expect(resolveEnvironmentLabel({ host: 'localhost:5173' })).toBe('');
  });
});
