import { describe, expect, it } from 'vitest';
import * as mapas from './resource-option-help';

/** Cada texto dice algo (4+ palabras) y no es el propio código repetido. */
describe('qué significa cada valor de los dominios de los listados', () => {
  for (const [nombre, mapa] of Object.entries(mapas)) {
    it(`${nombre}: todas las entradas explican el valor`, () => {
      const malas = Object.entries(mapa).filter(
        ([valor, texto]) =>
          texto.trim().split(/\s+/).length < 4 || texto.toLowerCase() === valor.toLowerCase(),
      );
      expect(malas).toEqual([]);
    });
  }
});
