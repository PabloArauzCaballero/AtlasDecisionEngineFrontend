import type { UnknownRecord } from '../../utils/records';
import { analyzeFlow } from './flow-analysis';
import { enumeratePaths } from './flow-paths';

export interface SectionSummary {
  /** Lo que se lee con la sección plegada. */
  text: string;
  /** Ámbar: falta algo que el propio resumen ya nombra. */
  attention: boolean;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Resumen de «Datos y contrato» con la sección plegada.
 *
 * Plegar un panel sólo es aceptable si su titular dice lo que hay dentro: si
 * no, hay que abrirlo para descubrir que estaba vacío. Aquí se nombra lo que
 * falta —y sólo lo que falta— porque es lo único que obliga a abrirlo.
 */
export function summarizeData(input: {
  inputs: UnknownRecord[];
  outputs: UnknownRecord[];
  intermediates: UnknownRecord[];
  actions: UnknownRecord[];
  outputContract: UnknownRecord[];
}): SectionSummary {
  const missing: string[] = [];
  if (!input.inputs.length) missing.push('sin entradas');
  if (!input.outputs.length) missing.push('sin salidas');
  else if (input.outputContract.length < input.outputs.length) missing.push('contrato incompleto');

  const parts = [
    count(input.inputs.length, 'entrada', 'entradas'),
    count(input.outputs.length, 'salida', 'salidas'),
  ];
  if (input.intermediates.length)
    parts.push(count(input.intermediates.length, 'intermedia', 'intermedias'));
  if (input.actions.length) parts.push(count(input.actions.length, 'acción', 'acciones'));

  return {
    text: missing.length ? `${parts.join(' · ')} — ${missing.join(', ')}` : parts.join(' · '),
    attention: missing.length > 0,
  };
}

/** Resumen de «Análisis del flujo»: recorridos posibles y avisos que bloquean. */
export function summarizeFlow(input: {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  inputs: UnknownRecord[];
  outputs: UnknownRecord[];
  actions: UnknownRecord[];
}): SectionSummary {
  if (!input.nodes.length) {
    return { text: 'aún no hay flujo que analizar', attention: false };
  }
  const paths = enumeratePaths(input.nodes, input.edges);
  const issues = analyzeFlow(input);
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;

  const parts = [count(paths.length, 'recorrido', 'recorridos')];
  if (errors) {
    // El verbo concuerda con el número: «1 aviso que bloquea», no «que bloquean».
    parts.push(`${count(errors, 'aviso', 'avisos')} que ${errors === 1 ? 'bloquea' : 'bloquean'}`);
  }
  if (warnings) parts.push(count(warnings, 'aviso', 'avisos'));
  if (!issues.length) parts.push('sin avisos');

  return { text: parts.join(' · '), attention: errors > 0 };
}
