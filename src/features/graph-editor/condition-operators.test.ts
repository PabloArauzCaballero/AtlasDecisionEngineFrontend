import { describe, expect, it } from 'vitest';
import {
  defaultOperatorFor,
  isComposite,
  readComparison,
  expectsList,
  expectsText,
  isOperatorValidFor,
  OPERATOR_LABELS,
  operatorsFor,
} from './condition-operators';

/**
 * El editor ofrecía la MISMA lista para todos los tipos y arrancaba en `gte`.
 * Preguntar si un estado de KYC es «mayor o igual» que otro no significa nada
 * para quien escribe la regla, y en JavaScript compara alfabéticamente: la
 * condición se guardaba, se publicaba y decidía por un criterio que nadie eligió.
 */
describe('operadores por tipo de dato', () => {
  it('un texto se compara e inspecciona, no se ordena', () => {
    const forString = operatorsFor('STRING');
    expect(forString).toContain('eq');
    expect(forString).toContain('contains');
    expect(forString).toContain('starts_with');
    expect(forString).toContain('ends_with');
    // Lo que no debe estar: el orden no aplica a un texto.
    expect(forString).not.toContain('gte');
    expect(forString).not.toContain('lt');
  });

  it('un número sí admite orden', () => {
    expect(operatorsFor('DECIMAL')).toContain('gte');
    expect(operatorsFor('INTEGER')).toContain('lt');
  });

  it('una fecha se ordena igual que un número: antes es «menor»', () => {
    expect(operatorsFor('DATE')).toContain('lt');
    // Buscar dentro de una fecha no tiene sentido.
    expect(operatorsFor('DATE')).not.toContain('contains');
  });

  it('un booleano sólo puede ser lo uno o lo otro', () => {
    expect(operatorsFor('BOOLEAN')).toEqual(['eq', 'neq']);
  });

  it('un enum se trata como texto: es lo que hace útil el switch por tramos', () => {
    expect(operatorsFor('ENUM')).toContain('in');
    expect(operatorsFor('ENUM')).not.toContain('gt');
  });

  it('sin tipo declarado no se adivina: se ofrece todo', () => {
    expect(operatorsFor('').length).toBeGreaterThan(operatorsFor('BOOLEAN').length);
  });

  it('el operador de partida depende del tipo', () => {
    expect(defaultOperatorFor('DECIMAL')).toBe('gte');
    expect(defaultOperatorFor('DATE')).toBe('gte');
    expect(defaultOperatorFor('STRING')).toBe('eq');
    expect(defaultOperatorFor('BOOLEAN')).toBe('eq');
    expect(defaultOperatorFor('LIST')).toBe('contains');
  });

  it('detecta el operador que no aplica, para no dejar la condición inválida', () => {
    // Es el caso real: cambiar de `edad` a `estado_kyc` arrastrando «mayor o igual».
    expect(isOperatorValidFor('STRING', 'gte')).toBe(false);
    expect(isOperatorValidFor('STRING', 'contains')).toBe(true);
    expect(isOperatorValidFor('DECIMAL', 'gte')).toBe(true);
  });

  it('distingue qué forma espera el valor de comparación', () => {
    expect(expectsList('in')).toBe(true);
    expect(expectsList('not_in')).toBe(true);
    expect(expectsList('eq')).toBe(false);
    expect(expectsText('starts_with')).toBe(true);
    expect(expectsText('gte')).toBe(false);
  });

  it('todo operador ofrecido tiene etiqueta en castellano', () => {
    for (const type of ['STRING', 'DECIMAL', 'DATE', 'BOOLEAN', 'LIST', '']) {
      for (const operator of operatorsFor(type)) {
        expect(OPERATOR_LABELS[operator], `falta etiqueta de ${operator}`).toBeTruthy();
      }
    }
  });
});

/**
 * El editor sólo sabía leer la forma plana que él mismo escribe. Al abrir una
 * condición SEMBRADA —que viene en forma de árbol, igual que la del compilador—
 * mostraba todos los campos vacíos y parecía sin configurar, cuando estaba
 * configurada y decidía correctamente.
 */
describe('lectura de la expresión guardada', () => {
  it('lee la forma plana que escribe el propio editor', () => {
    expect(readComparison({ variable: 'edad', operator: 'gte', value: 18 })).toEqual({
      variable: 'edad',
      operator: 'gte',
      value: 18,
    });
  });

  it('lee la forma de árbol que producen el compilador y los seeders', () => {
    // Es literalmente COND_DPD_31_60 del algoritmo de cobranza sembrado.
    expect(
      readComparison({
        op: 'eq',
        left: { var: 'current_delinquency_bucket' },
        right: { value: 'DPD_31_60' },
      }),
    ).toEqual({ variable: 'current_delinquency_bucket', operator: 'eq', value: 'DPD_31_60' });
  });

  it('una bandera booleana suelta se lee como «es verdadero»', () => {
    expect(readComparison({ var: 'bankruptcy_flag' })).toEqual({
      variable: 'bankruptcy_flag',
      operator: 'eq',
      value: true,
    });
  });

  it('una expresión compuesta no se finge simple', () => {
    const orExpression = {
      op: 'or',
      args: [{ var: 'a' }, { var: 'b' }],
    };
    expect(readComparison(orExpression)).toBeNull();
    expect(isComposite(orExpression)).toBe(true);
  });

  it('una condición todavía vacía no es compuesta: está sin empezar', () => {
    expect(isComposite({})).toBe(false);
    expect(isComposite(undefined)).toBe(false);
  });
});
