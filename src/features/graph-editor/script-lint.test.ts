import { lintScript } from './script-lint';

describe('script lint for code nodes', () => {
  it('accepts a well-formed JavaScript expression', () => {
    expect(lintScript('return variables.monthlyIncome * 0.35;', 'JAVASCRIPT', [])).toEqual([]);
  });

  it('accepts a well-formed Python expression', () => {
    expect(lintScript('result = variables["monthlyIncome"] * 0.35', 'PYTHON', [])).toEqual([]);
  });

  it('rejects empty sources before any other rule', () => {
    expect(lintScript('   ', 'JAVASCRIPT', ['score'])).toEqual(['El código no puede estar vacío.']);
  });

  it('flags sandboxed constructs per language', () => {
    expect(lintScript('return require("fs");', 'JAVASCRIPT', [])).toContain(
      'Prohibido: no se permite require().',
    );
    expect(lintScript('result = eval("1")', 'PYTHON', [])).toContain(
      'Prohibido: no se permite eval().',
    );
  });

  it('demands the output shape of each language', () => {
    expect(lintScript('const x = 1;', 'JAVASCRIPT', [])).toContain(
      'JavaScript debe retornar un objeto con las claves de salida.',
    );
    expect(lintScript('x = 1', 'PYTHON', [])).toContain(
      'Python debe asignar el objeto de salida a la variable `result`.',
    );
  });

  it('skips the output-reference rule when no contract is provided', () => {
    // Expression/score nodes bind their value via targetVariable, so lint must
    // not require the script to mention any output code.
    expect(lintScript('return 1;', 'JAVASCRIPT', [])).toEqual([]);
    expect(lintScript('return 1;', 'JAVASCRIPT', ['score'])).toContain(
      'El script no referencia ninguna variable de salida declarada.',
    );
  });
});
