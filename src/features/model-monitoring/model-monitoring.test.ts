import { describe, expect, it } from 'vitest';
import { asPercent, stabilityTone } from './useModelMonitoring';

/**
 * Los dos ayudantes que traducen números del motor a lo que se lee en pantalla.
 *
 * Pequeños y con una trampa cada uno: confundir «no se pudo medir» con cero, y pintar de verde una
 * población que se ha desplazado. Las dos convierten una pantalla de vigilancia en una que
 * tranquiliza sin motivo, que es peor que no tenerla.
 */
describe('asPercent', () => {
  it('convierte la fracción a porcentaje con un decimal', () => {
    expect(asPercent(0.042)).toBe('4.2 %');
    expect(asPercent(1)).toBe('100.0 %');
    expect(asPercent(0)).toBe('0.0 %');
  });

  it('distingue «no se pudo medir» de cero', () => {
    // El motor devuelve `null` cuando no hay denominador. Pintarlo como «0,0 %» diría que ninguno
    // salió mal, cuando lo cierto es que todavía no se sabe de ninguno.
    expect(asPercent(null)).toBe('—');
    expect(asPercent(undefined)).toBe('—');
    expect(asPercent('0.5')).toBe('—');
    expect(asPercent(Number.NaN)).toBe('—');
  });
});

describe('stabilityTone', () => {
  it('sólo da por buena la población estable', () => {
    expect(stabilityTone('STABLE')).toBe('success');
    expect(stabilityTone('SHIFTED')).toBe('warning');
    expect(stabilityTone('UNSTABLE')).toBe('danger');
  });

  it('un veredicto que no reconoce NO se pinta como estable', () => {
    // Si el motor publica mañana un veredicto nuevo, tratarlo como verde por no conocerlo sería
    // exactamente el silencio que esta pantalla existe para romper.
    expect(stabilityTone('LO_QUE_SEA')).toBe('danger');
    expect(stabilityTone('')).toBe('danger');
  });
});
