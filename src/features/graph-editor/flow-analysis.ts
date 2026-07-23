import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/** A single consistency finding about the graph's input/output flow. */
export interface FlowIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  nodeKey?: string;
}

export interface FlowInput {
  nodes: UnknownRecord[];
  edges: UnknownRecord[];
  inputs: UnknownRecord[];
  outputs: UnknownRecord[];
}

const TERMINAL_TYPES = new Set(['RESULT', 'END', 'MANUAL_REVIEW']);

function isTerminal(node: UnknownRecord): boolean {
  return Boolean(node.terminal) || TERMINAL_TYPES.has(display(node, 'type'));
}

/** Node keys reachable from the START node following outgoing edges. */
function reachableFromStart(nodes: UnknownRecord[], edges: UnknownRecord[]): Set<string> {
  const start = nodes.find((node) => display(node, 'type') === 'START');
  const reached = new Set<string>();
  if (!start) return reached;
  const pending = [display(start, 'key')];
  while (pending.length) {
    const current = pending.pop();
    if (!current || reached.has(current)) continue;
    reached.add(current);
    for (const edge of edges) {
      if (display(edge, 'from') === current) pending.push(display(edge, 'to'));
    }
  }
  return reached;
}

/** Output variable codes that at least one RESULT node writes to. */
function assignedOutputCodes(nodes: UnknownRecord[]): { codes: Set<string>; hasScript: boolean } {
  const codes = new Set<string>();
  let hasScript = false;
  for (const node of nodes) {
    if (display(node, 'type') !== 'RESULT') continue;
    const config = asRecord(node.config);
    const mode = String(config.mode ?? 'MAPPING');
    if (mode === 'SCRIPT') {
      hasScript = true;
      continue;
    }
    const rows =
      mode === 'REFERENCE' ? asRows(config.outputAssignments) : asRows(config.assignments);
    for (const row of rows) {
      const code = display(row, 'outputCode');
      if (code !== '—') codes.add(code);
    }
  }
  return { codes, hasScript };
}

/**
 * Static review of whether the graph's inputs and outputs form a coherent flow:
 * a START that reaches a terminal, declared outputs actually produced, result
 * assignments referencing real inputs, and no orphan nodes. Pure and deterministic
 * so the editor can surface it live and tests can pin every rule.
 */
export function analyzeFlow({ nodes, edges, inputs, outputs }: FlowInput): FlowIssue[] {
  const issues: FlowIssue[] = [];
  if (!nodes.length) return issues;

  const hasStart = nodes.some((node) => display(node, 'type') === 'START');
  if (!hasStart) {
    issues.push({
      code: 'NO_START',
      severity: 'error',
      message: 'El flujo no tiene un nodo de inicio (START). Añade uno para poder ejecutarlo.',
    });
  }

  if (!outputs.length) {
    issues.push({
      code: 'NO_OUTPUTS',
      severity: 'warning',
      message: 'No hay variables de salida en el contrato: la decisión no devolverá ningún valor.',
    });
  }

  const reached = reachableFromStart(nodes, edges);
  const reachesTerminal = nodes.some(
    (node) => reached.has(display(node, 'key')) && isTerminal(node),
  );
  if (hasStart && !reachesTerminal) {
    issues.push({
      code: 'NO_TERMINAL_PATH',
      severity: 'error',
      message: 'Desde el inicio no se alcanza ningún nodo terminal (Resultado/Fin/Revisión).',
    });
  }

  // Orphan nodes: unreachable from START, or a non-terminal dead end with no exit.
  for (const node of nodes) {
    const key = display(node, 'key');
    if (display(node, 'type') === 'START') continue;
    if (hasStart && !reached.has(key)) {
      issues.push({
        code: 'UNREACHABLE_NODE',
        severity: 'warning',
        message: `El nodo «${display(node, 'label', 'key')}» no se conecta con el flujo desde el inicio.`,
        nodeKey: key,
      });
      continue;
    }
    const hasOutgoing = edges.some((edge) => display(edge, 'from') === key);
    if (!isTerminal(node) && !hasOutgoing) {
      issues.push({
        code: 'DEAD_END',
        severity: 'warning',
        message: `El nodo «${display(node, 'label', 'key')}» no es terminal pero no tiene ninguna salida.`,
        nodeKey: key,
      });
    }
  }

  // Every declared output should be produced by some RESULT node.
  const { codes: assigned, hasScript } = assignedOutputCodes(nodes);
  if (!hasScript) {
    for (const output of outputs) {
      const code = display(output, 'code');
      if (code !== '—' && !assigned.has(code)) {
        issues.push({
          code: 'OUTPUT_UNASSIGNED',
          severity: 'warning',
          message: `La variable de salida «${code}» no se asigna en ningún nodo de resultado.`,
        });
      }
    }
  }

  // MAPPING result assignments that read an input variable must reference a real input.
  const inputCodes = new Set(inputs.map((input) => display(input, 'code')));
  for (const node of nodes) {
    if (display(node, 'type') !== 'RESULT') continue;
    const config = asRecord(node.config);
    if (String(config.mode ?? 'MAPPING') !== 'MAPPING') continue;
    for (const assignment of asRows(config.assignments)) {
      if (String(assignment.source ?? '') !== 'VARIABLE') continue;
      const path = display(assignment, 'variablePath');
      if (path !== '—' && !inputCodes.has(path)) {
        issues.push({
          code: 'RESULT_INPUT_UNKNOWN',
          severity: 'warning',
          message: `Un resultado usa la variable de entrada «${path}», que no está declarada en el contrato.`,
          nodeKey: display(node, 'key'),
        });
      }
    }
  }

  return issues;
}
