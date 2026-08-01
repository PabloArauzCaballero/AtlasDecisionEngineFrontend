import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltip-placement';

const VIEWPORT = { width: 1280, height: 800 };
const CARD = { top: 0, left: 0, width: 340, height: 320 };

/** Comprueba que la tarjeta entera queda dentro de la ventana. */
function fits(top: number, left: number, card = CARD, viewport = VIEWPORT) {
  return (
    top >= 0 &&
    left >= 0 &&
    top + card.height <= viewport.height &&
    left + card.width <= viewport.width
  );
}

describe('placeTooltip', () => {
  it('coloca la tarjeta debajo del elemento cuando hay sitio', () => {
    const target = { top: 100, left: 200, width: 240, height: 40 };

    const placement = placeTooltip(target, CARD, VIEWPORT);

    expect(placement.side).toBe('below');
    expect(placement.top).toBeGreaterThan(target.top + target.height);
    expect(fits(placement.top, placement.left)).toBe(true);
  });

  it('la sube encima cuando abajo se saldría de la pantalla', () => {
    // Éste era el fallo: el elemento está en la mitad baja y la tarjeta mide más
    // de lo que se asumía, así que quedaba cortada por el borde inferior.
    const target = { top: 560, left: 300, width: 200, height: 44 };

    const placement = placeTooltip(target, CARD, VIEWPORT);

    expect(placement.side).toBe('above');
    expect(placement.top + CARD.height).toBeLessThanOrEqual(target.top);
    expect(fits(placement.top, placement.left)).toBe(true);
  });

  it('se va a un lado cuando no cabe ni arriba ni abajo', () => {
    const target = { top: 40, left: 60, width: 220, height: 700 };

    const placement = placeTooltip(target, CARD, VIEWPORT);

    expect(placement.side).toBe('right');
    expect(placement.left).toBeGreaterThanOrEqual(target.left + target.width);
    expect(fits(placement.top, placement.left)).toBe(true);
  });

  it('usa el lado izquierdo si por la derecha no entra', () => {
    const target = { top: 40, left: 900, width: 340, height: 700 };

    const placement = placeTooltip(target, CARD, VIEWPORT);

    expect(placement.side).toBe('left');
    expect(placement.left + CARD.width).toBeLessThanOrEqual(target.left);
  });

  it('nunca deja la tarjeta fuera de la ventana, aunque el elemento esté al borde', () => {
    for (const target of [
      { top: 0, left: 0, width: 10, height: 10 },
      { top: 790, left: 1270, width: 10, height: 10 },
      { top: 400, left: 1200, width: 80, height: 40 },
    ]) {
      const placement = placeTooltip(target, CARD, VIEWPORT);
      expect(placement.left).toBeGreaterThanOrEqual(0);
      expect(placement.left + CARD.width).toBeLessThanOrEqual(VIEWPORT.width);
      expect(placement.top).toBeGreaterThanOrEqual(0);
    }
  });

  it('encaja la tarjeta dentro de la ventana cuando no cabe en ningún lado', () => {
    // Móvil apaisado con un paso largo: no hay hueco completo en ninguna
    // dirección, pero la tarjeta debe seguir empezando dentro de la pantalla —
    // la hoja de estilos le da scroll interno.
    const small = { width: 420, height: 360 };
    const target = { top: 150, left: 40, width: 340, height: 80 };

    const placement = placeTooltip(target, CARD, small);

    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.top).toBeLessThan(small.height);
    expect(placement.left).toBeGreaterThanOrEqual(0);
  });
});
