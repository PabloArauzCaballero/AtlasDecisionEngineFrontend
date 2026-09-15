import { describe, expect, it } from 'vitest';
import { ayudaDeCampo, opcionesDeEnum } from './template-field-help';

describe('ayuda de los campos de plantilla', () => {
  it('manda la descripción que declare la plantilla', () => {
    expect(ayudaDeCampo('title', { type: 'string', required: true, description: 'Lo suyo' })).toBe(
      'Lo suyo',
    );
  });

  it('sin descripción usa el mapa local, y sin mapa dice lo que se sabe del contrato', () => {
    expect(ayudaDeCampo('score', { type: 'number', required: false })).toMatch(/Puntaje/);
    expect(ayudaDeCampo('otro', { type: 'integer', required: true })).toBe(
      'Campo obligatorio de tipo integer que exige el contrato de esta plantilla.',
    );
  });

  it('describe los valores conocidos y NO inventa los que no conoce', () => {
    const [aprobado, raro] = opcionesDeEnum('decision', ['APPROVED', 'RARO']);
    expect(aprobado.description).toMatch(/aprobada/);
    expect(raro).toEqual({ value: 'RARO', label: 'RARO', description: undefined });
  });
});
