import { describe, expect, it } from 'vitest';
import { explainImportIssue, localPythonIssues } from './code-import-issues';
import type { CodeImportIssue } from './CodeImportIssuesList';

const issue = (partial: Partial<CodeImportIssue>): CodeImportIssue => ({
  source: 'GRAPH',
  severity: 'WARNING',
  line: 1,
  message: '',
  code: '',
  ...partial,
});

describe('explainImportIssue', () => {
  it('explica por qué el árbol no se derivó y qué cambiar', () => {
    const explanation = explainImportIssue(
      issue({
        code: 'CODE_IMPORT_TREE_NOT_DERIVABLE',
        message:
          'No se pudo derivar el árbol de decisión: la clave de un resultado debe ser un texto.',
      }),
    );

    expect(explanation?.cause).toMatch(/no sabe traducir|no puede leer clave por clave/);
    expect(explanation?.fix).toMatch(/una sola línea/);
  });

  it('reconoce el aviso por su mensaje aunque cambie el código', () => {
    const explanation = explainImportIssue(
      issue({ code: 'OTRO_CODIGO', message: 'la clave de un resultado debe ser un texto' }),
    );

    expect(explanation?.fix).toMatch(/una sola línea/);
  });

  it('avisa de la trampa de las mayúsculas acentuadas en un error de sintaxis', () => {
    const explanation = explainImportIssue(
      issue({ code: 'PYTHON_SYNTAX_ERROR', severity: 'ERROR', message: 'Python syntax error' }),
    );

    expect(explanation?.cause).toMatch(/acentuada en MAYÚSCULA/);
    expect(explanation?.cause).toMatch(/línea 1/);
  });

  it('no inventa explicaciones para avisos que no conoce', () => {
    expect(explainImportIssue(issue({ code: 'ALGO_NUEVO', message: 'algo raro' }))).toBeNull();
  });
});

describe('localPythonIssues', () => {
  it('señala la línea y el carácter exactos de una mayúscula acentuada', () => {
    const source = ['# comentario normal', '# ARBOL con Á dentro', 'x = 1'].join('\n');

    const found = localPythonIssues(source);

    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(2);
    expect(found[0].column).toBe(13);
    expect(found[0].severity).toBe('ERROR');
    expect(found[0].message).toContain('Á');
  });

  it('detecta también las que están dentro de un texto del código', () => {
    const found = localPythonIssues('result = {"decision": "APROBADO ÉXITO"}');

    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('É');
  });

  it('no molesta con lo que el analizador sí acepta', () => {
    // Minúsculas acentuadas y Ñ funcionan; marcarlas sería una falsa alarma.
    expect(localPythonIssues('# año: decisión de crédito con tildes áéíóú')).toEqual([]);
    expect(localPythonIssues('x = 1')).toEqual([]);
  });

  it('reporta una observación por línea afectada', () => {
    const found = localPythonIssues(['# Á', 'x = 1', '# Ó y Ú'].join('\n'));

    expect(found.map((entry) => entry.line)).toEqual([1, 3]);
    expect(found[1].message).toContain('Ó Ú');
  });
});
