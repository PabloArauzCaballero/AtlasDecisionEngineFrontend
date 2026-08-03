import { describe, expect, it } from 'vitest';
import { analyzeFlow, type FlowInput } from './flow-analysis';

const output = (code: string) => ({ code, usageType: 'OUTPUT_PRIMARY', dataType: 'NUMBER' });
const input = (code: string) => ({ code, usageType: 'INPUT', dataType: 'NUMBER' });
/** Salida de apoyo: dato publicado que no es la conclusión. */
const secondary = (code: string) => ({ code, usageType: 'OUTPUT', dataType: 'NUMBER' });

/** A minimal healthy flow: START → RESULT that assigns the single output from an input. */
function healthy(): FlowInput {
  return {
    nodes: [
      { key: 'START', type: 'START', terminal: false },
      {
        key: 'RESULT_1',
        type: 'RESULT',
        terminal: true,
        config: {
          mode: 'MAPPING',
          assignments: [{ outputCode: 'score', source: 'VARIABLE', variablePath: 'income' }],
        },
      },
    ],
    edges: [{ key: 'START__RESULT_1', from: 'START', to: 'RESULT_1' }],
    inputs: [input('income')],
    outputs: [output('score')],
  };
}

describe('analyzeFlow', () => {
  it('reports no issues for a coherent START → RESULT flow', () => {
    expect(analyzeFlow(healthy())).toEqual([]);
  });

  it('returns nothing for an empty canvas (nothing to validate yet)', () => {
    expect(analyzeFlow({ nodes: [], edges: [], inputs: [], outputs: [] })).toEqual([]);
  });

  it('flags a missing START node as an error', () => {
    const graph = healthy();
    graph.nodes = graph.nodes.filter((node) => node.type !== 'START');
    graph.edges = [];
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).toContain('NO_START');
  });

  it('errors when the start never reaches a terminal node', () => {
    const graph = healthy();
    graph.edges = [];
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).toContain('NO_TERMINAL_PATH');
  });

  it('warns about an output variable no result assigns', () => {
    const graph = healthy();
    graph.outputs = [output('score'), output('riskBand')];
    const issue = analyzeFlow(graph).find((entry) => entry.code === 'OUTPUT_UNASSIGNED');
    expect(issue?.message).toContain('riskBand');
  });

  it('does not warn about unassigned outputs when a SCRIPT result is present', () => {
    const graph = healthy();
    graph.outputs = [output('score'), output('riskBand')];
    graph.nodes.push({
      key: 'RESULT_2',
      type: 'RESULT',
      terminal: true,
      config: { mode: 'SCRIPT', script: { language: 'JAVASCRIPT', source: 'return {};' } },
    });
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).not.toContain('OUTPUT_UNASSIGNED');
  });

  it('counts REFERENCE output assignments as producing the output', () => {
    const graph = healthy();
    graph.nodes[1] = {
      key: 'RESULT_1',
      type: 'RESULT',
      terminal: true,
      config: { mode: 'REFERENCE', outputAssignments: [{ outputCode: 'score' }] },
    };
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).not.toContain('OUTPUT_UNASSIGNED');
  });

  it('warns when a result reads an input that is not declared', () => {
    const graph = healthy();
    graph.inputs = [input('age')]; // result references "income", now undeclared
    const issue = analyzeFlow(graph).find((entry) => entry.code === 'RESULT_INPUT_UNKNOWN');
    expect(issue?.message).toContain('income');
  });

  it('warns about an unreachable node', () => {
    const graph = healthy();
    graph.nodes.push({ key: 'EXPRESSION_1', type: 'EXPRESSION', terminal: false, config: {} });
    const issue = analyzeFlow(graph).find((entry) => entry.code === 'UNREACHABLE_NODE');
    expect(issue?.nodeKey).toBe('EXPRESSION_1');
  });

  it('warns about a non-terminal dead end that is reachable but has no exit', () => {
    const graph = healthy();
    graph.nodes.push({ key: 'EXPRESSION_1', type: 'EXPRESSION', terminal: false, config: {} });
    graph.edges.push({ key: 'START__EXPRESSION_1', from: 'START', to: 'EXPRESSION_1' });
    const issue = analyzeFlow(graph).find((entry) => entry.code === 'DEAD_END');
    expect(issue?.nodeKey).toBe('EXPRESSION_1');
  });

  it('does NOT warn about missing declared outputs when a Result node infers it', () => {
    const graph = healthy();
    graph.outputs = [];
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).not.toContain('NO_OUTPUTS');
  });

  it('warns NO_OUTPUTS only when nothing can produce a result (no Result node)', () => {
    const graph = healthy();
    graph.outputs = [];
    graph.nodes = graph.nodes.filter((node) => node.type !== 'RESULT');
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).toContain('NO_OUTPUTS');
  });

  it('errors when a node has exits but no path reaches a terminal (loop)', () => {
    const graph = healthy();
    graph.nodes.push({ key: 'A', type: 'EXPRESSION', terminal: false, config: {} });
    graph.nodes.push({ key: 'B', type: 'EXPRESSION', terminal: false, config: {} });
    graph.edges.push({ key: 'START__A', from: 'START', to: 'A' });
    graph.edges.push({ key: 'A__B', from: 'A', to: 'B' });
    graph.edges.push({ key: 'B__A', from: 'B', to: 'A' });
    const issue = analyzeFlow(graph).find((entry) => entry.code === 'NODE_NO_TERMINAL_PATH');
    expect(issue?.severity).toBe('error');
    expect(['A', 'B']).toContain(issue?.nodeKey);
  });

  it('rechaza dos conclusiones, que es lo que de verdad es ambiguo', () => {
    const graph = healthy();
    graph.outputs = [output('score'), output('riskBand')];
    const issue = analyzeFlow(graph).find((entry) => entry.code === 'MULTIPLE_PRIMARY_OUTPUTS');
    expect(issue?.severity).toBe('error');
  });

  it('NO se queja de salidas de apoyo junto a una única principal', () => {
    // Un algoritmo real publica el score de cada etapa, el tramo de riesgo y el
    // precio además de la decisión. Antes se pedía «deja solo la principal», es
    // decir, borrar datos que alguien consume.
    const graph = healthy();
    graph.outputs = [output('score'), secondary('risk_band'), secondary('pricing_tier')];
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).not.toContain('MULTIPLE_PRIMARY_OUTPUTS');
    expect(codes).not.toContain('NO_PRIMARY_OUTPUT');
  });

  it('avisa cuando ninguna salida es la conclusión', () => {
    const graph = healthy();
    graph.outputs = [secondary('score'), secondary('risk_band')];
    const codes = analyzeFlow(graph).map((issue) => issue.code);
    expect(codes).toContain('NO_PRIMARY_OUTPUT');
  });

  it('cuenta como asignada la salida que escribe un campo calculado', () => {
    // Se producen también fuera de un nodo Resultado; mirar sólo allí generaba un
    // aviso falso por cada salida del algoritmo.
    const graph = healthy();
    graph.outputs = [output('score'), secondary('dti_publicado')];
    graph.nodes.push({
      key: 'CALC',
      type: 'ACTION',
      terminal: false,
      calculatedFieldCalls: [{ target: { kind: 'OUTPUT', code: 'dti_publicado' } }],
    });
    graph.edges.push({ key: 'START__CALC', from: 'START', to: 'CALC' });
    graph.edges.push({ key: 'CALC__RESULT', from: 'CALC', to: 'RESULT' });
    const unassigned = analyzeFlow(graph).filter((entry) => entry.code === 'OUTPUT_UNASSIGNED');
    expect(unassigned).toEqual([]);
  });

  it('does not flag a healthy single-output tree', () => {
    const codes = analyzeFlow(healthy()).map((issue) => issue.code);
    expect(codes).not.toContain('MULTIPLE_PRIMARY_OUTPUTS');
    expect(codes).not.toContain('NODE_NO_TERMINAL_PATH');
  });
});
