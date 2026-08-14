import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_LIMIT_MS,
  ACTIVITY_EVENTS,
  IDLE_LIMIT_MS,
  WARNING_BEFORE_MS,
  deadlinesFrom,
  msUntil,
  nextDeadline,
} from './session-limits';

const MIN = 60_000;

describe('topes de sesión (NIST SP 800-63B, AAL2)', () => {
  it('fija 30 minutos de inactividad y 12 horas absolutas', () => {
    expect(IDLE_LIMIT_MS).toBe(30 * MIN);
    expect(ABSOLUTE_LIMIT_MS).toBe(12 * 60 * MIN);
  });

  it('avisa antes de cerrar, con margen para guardar', () => {
    expect(WARNING_BEFORE_MS).toBeGreaterThan(0);
    expect(WARNING_BEFORE_MS).toBeLessThan(IDLE_LIMIT_MS);
  });

  /*
   * Mover el ratón NO cuenta como actividad: un cable rozando el ratón, o una
   * página que se desplaza sola por una animación, mantendrían viva una sesión
   * que nadie está usando — y entonces el tope no protege de nada.
   */
  it('no toma el movimiento del ratón ni el desplazamiento por actividad', () => {
    expect(ACTIVITY_EVENTS).not.toContain('mousemove');
    expect(ACTIVITY_EVENTS).not.toContain('scroll');
    expect(ACTIVITY_EVENTS).toContain('keydown');
    expect(ACTIVITY_EVENTS).toContain('pointerdown');
  });
});

describe('deadlinesFrom / nextDeadline', () => {
  it('cuenta la inactividad desde el último gesto y el tope desde el acceso', () => {
    const inicio = 1_000_000;
    const ultimoGesto = inicio + 5 * MIN;
    const { idleAt, absoluteAt } = deadlinesFrom(inicio, ultimoGesto);
    expect(idleAt).toBe(ultimoGesto + IDLE_LIMIT_MS);
    expect(absoluteAt).toBe(inicio + ABSOLUTE_LIMIT_MS);
  });

  it('manda el plazo que venza antes: son dos techos, no dos opciones', () => {
    const inicio = 0;
    // Sesión recién abierta y quieta: cierra por inactividad.
    expect(nextDeadline(deadlinesFrom(inicio, inicio))).toBe(IDLE_LIMIT_MS);
    // Sesión de casi doce horas, en uso constante: manda el tope absoluto.
    const casiDoce = ABSOLUTE_LIMIT_MS - MIN;
    expect(nextDeadline(deadlinesFrom(inicio, casiDoce))).toBe(ABSOLUTE_LIMIT_MS);
  });

  it('una sesión activa NO se prolonga más allá del tope absoluto', () => {
    const inicio = 0;
    // Aunque el último gesto sea justo ahora, a las doce horas se cierra igual.
    const gesto = ABSOLUTE_LIMIT_MS;
    expect(nextDeadline(deadlinesFrom(inicio, gesto))).toBe(ABSOLUTE_LIMIT_MS);
  });
});

describe('msUntil', () => {
  it('nunca devuelve negativo', () => {
    // Un retraso negativo en `setTimeout` dispara de inmediato, y en un bucle de
    // re-armado eso es una tormenta de temporizadores.
    expect(msUntil(100, 500)).toBe(0);
    expect(msUntil(500, 100)).toBe(400);
  });
});
