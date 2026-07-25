import { describe, expect, it } from 'vitest';
import { analyzeFlow, type FlowInput } from './flow-analysis';

const output = (code: string) => ({ code, usageType: 'OUTPUT_PRIMARY', dataType: 'NUMBER' });
const input = (code: string) => ({ code, usageType: 'INPUT', dataType: 'NUMBER' });

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
});
