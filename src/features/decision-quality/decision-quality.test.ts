import { describe, expect, it } from 'vitest';
import { asPercent, coverageTone } from './decision-quality.api';

/**
 * Las dos funciones que deciden cómo se LEE la cobertura.
 *
 * Las dos existen por el mismo error, cometido dos veces: tratar «no se pudo medir» como si
 * fuera cero. Un sistema que no decidió esta semana no tiene una cobertura del 0 %; no tiene
 * cobertura. Pintarlo en rojo produce una alarma falsa, y las alarmas falsas se desactivan —con
 * lo que la próxima vez que el indicador se ponga rojo de verdad, nadie mirará.
 */
describe('asPercent', () => {
  it('formatea una fracción como porcentaje', () => {
    expect(asPercent(0.993596)).toBe('99.4 %');
    expect(asPercent(0)).toBe('0.0 %');
  });

  it('distingue «no medido» de cero', () => {
    expect(asPercent(null)).toBe('—');
    expect(asPercent(undefined)).toBe('—');
    expect(asPercent(Number.NaN)).toBe('—');
  });
});

describe('coverageTone', () => {
  it('no colorea lo que no se pudo medir', () => {
    expect(coverageTone(null)).toBe('default');
  });

  it('exige casi todo para dar por buena la cobertura', () => {
    // El corte está alto a propósito: cada decisión sin sujeto es irreparable —el HMAC es de
    // una vía— así que un 95 % no es «casi perfecto», es una pérdida permanente del 5 %.
    expect(coverageTone(1)).toBe('success');
    expect(coverageTone(0.98)).toBe('success');
    expect(coverageTone(0.9799)).toBe('warning');
    expect(coverageTone(0.9)).toBe('warning');
    expect(coverageTone(0.8999)).toBe('danger');
    expect(coverageTone(0)).toBe('danger');
  });
});
