import { describe, expect, it } from 'vitest';
import { nodeIo, scriptReads } from './node-io';

const CONDITIONS = [
  { code: 'RIESGO_ALTO', expression: { variable: 'score_buro', operator: 'lt', value: 550 } },
];
const ACTIONS = [
  {
    code: 'RECHAZO_DOCUMENTAL',
    type: 'REJECT',
    terminal: true,
    payload: { canal: 'APP' },
    reasonCodes: [{ code: 'DOC_MISSING' }],
  },
];

describe('scriptReads', () => {
  it('reconoce las tres formas de leer variables en JS y Python', () => {
    const source = `
      const a = variables.ingreso_mensual;
      const b = variables["score_buro"];
      const c = variables.get('edad')
    `;

    expect(scriptReads(source).sort()).toEqual(['edad', 'ingreso_mensual', 'score_buro']);
  });

  it('no confunde el método get con una variable', () => {
    expect(scriptReads('variables.get("edad")')).toEqual(['edad']);
  });

  it('devuelve vacío cuando el código no lee nada', () => {
    expect(scriptReads('const x = 1 + 2;')).toEqual([]);
  });
});

describe('nodeIo', () => {
  it('dice qué variable evalúa una condición, resolviéndola por su código', () => {
    const io = nodeIo(
      { type: 'CONDITION', config: { conditionCode: 'RIESGO_ALTO' } },
      { conditions: CONDITIONS },
    );

    expect(io.reads).toEqual(['score_buro']);
    expect(io.writes).toEqual([]);
    expect(io.action).toContain('score_buro');
  });

  it('resuelve la condición también desde el vínculo del nodo', () => {
    const io = nodeIo(
      { type: 'CONDITION', conditions: [{ conditionCode: 'RIESGO_ALTO' }] },
      { conditions: CONDITIONS },
    );

    expect(io.reads).toEqual(['score_buro']);
  });

  it('para un nodo de código, lee del script y escribe en la variable destino', () => {
    const io = nodeIo({
      type: 'SCORE',
      config: {
        targetVariable: 'puntaje',
        script: { language: 'PYTHON', source: 'x = variables.get("ingreso_mensual")' },
      },
    });

    expect(io.reads).toEqual(['ingreso_mensual']);
    expect(io.writes).toEqual(['puntaje']);
    expect(io.action).toContain('PYTHON');
  });

  it('para un resultado por mapeo, lista las salidas que asigna', () => {
    const io = nodeIo({
      type: 'RESULT',
      config: {
        mode: 'MAPPING',
        assignments: [{ outputCode: 'decision' }, { outputCode: 'motivo' }],
      },
    });

    expect(io.writes).toEqual(['decision', 'motivo']);
    expect(io.action).toContain('2 variable(s)');
  });

  it('explica qué acción ejecuta un nodo de acción y qué motivos devuelve', () => {
    const io = nodeIo(
      { type: 'ACTION', actions: [{ actionCode: 'RECHAZO_DOCUMENTAL' }] },
      { actions: ACTIONS },
    );

    expect(io.action).toContain('RECHAZO_DOCUMENTAL');
    // Se describe lo que IMPLICA, no el código interno del tipo.
    expect(io.action).toContain('rechaza la solicitud');
    expect(io.writes).toEqual(['DOC_MISSING']);
  });

  it('avisa cuando el nodo apunta a una acción que no existe en el grafo', () => {
    const io = nodeIo(
      { type: 'ACTION', config: { actionCode: 'NO_EXISTE' } },
      { actions: ACTIONS },
    );

    expect(io.action).toContain('todavía no está definida');
  });

  it('reconoce un paso de acción sin nada configurado en lugar de callarlo', () => {
    expect(nodeIo({ type: 'ACTION' }).action).toContain('Todavía no tiene una acción asignada');
  });

  it('describe la revisión manual con su cola', () => {
    const io = nodeIo({ type: 'MANUAL_REVIEW', config: { queueCode: 'FRAUDE_N2' } });

    expect(io.action).toContain('FRAUDE_N2');
    expect(io.reads).toEqual([]);
  });

  it('no inventa variables cuando la configuración está vacía', () => {
    for (const type of ['CONDITION', 'SWITCH', 'EXPRESSION', 'RESULT', 'START', 'END']) {
      const io = nodeIo({ type });
      expect(io.reads, type).toEqual([]);
      expect(io.writes, type).toEqual([]);
    }
  });

  it('cuenta las reglas de una tabla de decisión y las variables que compara', () => {
    const io = nodeIo({
      type: 'DECISION_TABLE',
      config: { rules: [{ variable: 'edad' }, { variable: 'score_buro' }, { variable: 'edad' }] },
    });

    expect(io.reads).toEqual(['edad', 'score_buro']);
    expect(io.action).toContain('3 regla(s)');
  });
});
