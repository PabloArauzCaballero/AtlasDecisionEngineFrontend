import { describe, expect, it } from 'vitest';
import { detectSourceLanguage, languageMismatchIssues } from './code-import-language';

const PYTHON_FILE = [
  '# Algoritmo de decisión de crédito.',
  '',
  '# @atlas-contract',
  '# { "contractVersion": "1", "inputs": [], "outputs": [] }',
  'edad = variables.get("edad", 0)',
  'if edad < 18:',
  '    result = {"decision": "RECHAZADO"}',
  'else:',
  '    result = {"decision": "APROBADO"}',
].join('\n');

const JS_FILE = [
  '// @atlas-contract',
  '// { "contractVersion": "1", "inputs": [], "outputs": [] }',
  'if (variables.edad < 18) {',
  "  return { decision: 'RECHAZADO' };",
  '} else {',
  "  return { decision: 'APROBADO' };",
  '}',
].join('\n');

describe('detectSourceLanguage', () => {
  it('decide por el prefijo de comentario de la cabecera del contrato', () => {
    expect(detectSourceLanguage(PYTHON_FILE)).toBe('PYTHON');
    expect(detectSourceLanguage(JS_FILE)).toBe('JAVASCRIPT');
  });

  it('reconoce el lenguaje sin cabecera cuando los rasgos son claros', () => {
    expect(detectSourceLanguage('if edad < 18:\n    result = {"a": 1}\n')).toBe('PYTHON');
    expect(detectSourceLanguage('const x = 1;\nif (x) { return { a: 1 }; }\n')).toBe('JAVASCRIPT');
  });

  it('no opina cuando el código no distingue entre los dos', () => {
    // Sin rasgos propios de ninguno: mandar a cambiar el selector sería peor que callar.
    expect(detectSourceLanguage('x = 1\ny = x + 2\n')).toBeNull();
    expect(detectSourceLanguage('')).toBeNull();
  });
});

describe('languageMismatchIssues', () => {
  it('avisa antes de analizar cuando el selector no es el del código pegado', () => {
    const [issue] = languageMismatchIssues(PYTHON_FILE, 'JAVASCRIPT');

    expect(issue.severity).toBe('ERROR');
    expect(issue.code).toBe('CODE_IMPORT_LANGUAGE_MISMATCH');
    // La línea de la cabecera, que es donde se ve el desajuste.
    expect(issue.line).toBe(3);
    expect(issue.message).toContain('Python');
    expect(issue.message).toContain('JavaScript');
  });

  it('calla cuando el selector coincide o no hay certeza', () => {
    expect(languageMismatchIssues(PYTHON_FILE, 'PYTHON')).toEqual([]);
    expect(languageMismatchIssues(JS_FILE, 'JAVASCRIPT')).toEqual([]);
    expect(languageMismatchIssues('x = 1', 'JAVASCRIPT')).toEqual([]);
  });
});
