import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  effectiveDuration,
  motionTokens,
  playbackSpeeds,
  prefersReducedMotion,
  stepInterval,
} from './motion-tokens';

const css = readFileSync(join(process.cwd(), 'src/styles/parts/motion.css'), 'utf8');

function cssValue(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match) throw new Error(`La variable --${name} no existe en motion.css`);
  return match[1].trim();
}

/**
 * Los tokens viven duplicados en CSS y en TypeScript: el CSS los necesita para
 * las transiciones declarativas y el TS para las animaciones temporizadas por
 * código. Esta prueba es lo que impide que las dos copias se separen.
 */
describe('sincronía entre motion-tokens.ts y motion.css', () => {
  it('comparte las mismas duraciones', () => {
    expect(cssValue('dur-instant')).toBe(`${motionTokens.duration.instant}ms`);
    expect(cssValue('dur-fast')).toBe(`${motionTokens.duration.fast}ms`);
    expect(cssValue('dur-base')).toBe(`${motionTokens.duration.normal}ms`);
    expect(cssValue('dur-slow')).toBe(`${motionTokens.duration.slow}ms`);
    expect(cssValue('dur-loop')).toBe(`${motionTokens.duration.loop}ms`);
  });

  it('comparte las mismas curvas de transición', () => {
    expect(cssValue('ease-standard')).toBe(motionTokens.css.standard);
    expect(cssValue('ease-out')).toBe(motionTokens.css.enter);
    expect(cssValue('ease-in')).toBe(motionTokens.css.exit);
  });

  it('mantiene el interruptor global de movimiento reducido', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('reglas de duración', () => {
  it('mantiene la animación de interfaz por debajo de 320 ms', () => {
    const interactive = [
      motionTokens.duration.instant,
      motionTokens.duration.fast,
      motionTokens.duration.normal,
      motionTokens.duration.slow,
    ];
    for (const duration of interactive) expect(duration).toBeLessThanOrEqual(320);
  });

  it('anula la duración cuando se pide movimiento reducido', () => {
    expect(effectiveDuration(280, true)).toBe(0);
    expect(effectiveDuration(280, false)).toBe(280);
  });

  it('no asume preferencias cuando no hay navegador', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('velocidades de reproducción', () => {
  it('ofrece lenta, normal, rápida y paso a paso', () => {
    expect(playbackSpeeds.map((speed) => speed.id)).toEqual(['slow', 'normal', 'fast', 'step']);
  });

  it('ordena los intervalos de más lento a más rápido', () => {
    expect(stepInterval('slow')).toBeGreaterThan(stepInterval('normal'));
    expect(stepInterval('normal')).toBeGreaterThan(stepInterval('fast'));
  });

  it('no avanza solo en modo paso a paso', () => {
    expect(stepInterval('step')).toBe(0);
  });
});
