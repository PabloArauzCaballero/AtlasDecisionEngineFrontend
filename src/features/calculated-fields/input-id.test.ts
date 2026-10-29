import { describe, expect, it } from 'vitest';
import { inputIdFromVariableCode } from './input-id';

const VALIDO = /^[a-z][a-z0-9_]{1,119}$/;

describe('inputIdFromVariableCode', () => {
  it('pasa a minúsculas un código en mayúsculas', () => {
    expect(inputIdFromVariableCode('QA_H4_279386')).toBe('qa_h4_279386');
  });

  it('deja intacto un código que ya es válido', () => {
    expect(inputIdFromVariableCode('affordability_ratio')).toBe('affordability_ratio');
  });

  it('sustituye lo que el servidor no admite y antepone letra si empieza por dígito', () => {
    expect(inputIdFromVariableCode('9 Ingreso.Mensual-BOB')).toBe('v_9_ingreso_mensual_bob');
  });

  it('un código vacío o de un carácter sigue dando un id válido', () => {
    for (const code of ['', 'x', '   ', '___', '€€'])
      expect(inputIdFromVariableCode(code)).toMatch(VALIDO);
  });

  it('recorta al máximo que acepta el servidor', () => {
    expect(inputIdFromVariableCode('A'.repeat(300))).toHaveLength(120);
  });
});
