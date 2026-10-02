import { describe, expect, it } from 'vitest';
import { areaVisibleDeImagen } from './imagen-edicion';

describe('areaVisibleDeImagen', () => {
  it('centra una imagen vertical en una caja ancha dejando bandas a los lados', () => {
    const area = areaVisibleDeImagen({ ancho: 800, alto: 320 }, { ancho: 400, alto: 640 });
    expect(area.alto).toBe(320);
    expect(area.ancho).toBe(200);
    expect(area.x).toBe(300);
    expect(area.y).toBe(0);
  });

  it('usa todo el ancho cuando la imagen es apaisada', () => {
    const area = areaVisibleDeImagen({ ancho: 400, alto: 320 }, { ancho: 800, alto: 400 });
    expect(area.ancho).toBe(400);
    expect(area.alto).toBe(200);
    expect(area.y).toBe(60);
  });
});
