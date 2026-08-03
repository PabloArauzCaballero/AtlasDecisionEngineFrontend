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
  /**
   * Catálogo de acciones del grafo. Hace falta porque una acción que escribe un
   * campo lleva el destino en SU definición (`payload.field`), no en el nodo que
   * la ejecuta: sin esto no había forma de saber qué salidas quedan cubiertas.
   */
  actions?: UnknownRecord[];
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

/**
 * Node keys from which SOME terminal is reachable (reverse BFS from every terminal
 * over incoming edges). A decision tree requires every path to end in a terminal,
 * so any reachable non-terminal outside this set is a broken branch (e.g. a loop
 * that never concludes).
 */
function canReachTerminal(nodes: UnknownRecord[], edges: UnknownRecord[]): Set<string> {
  const good = new Set<string>();
  const pending = nodes.filter(isTerminal).map((node) => display(node, 'key'));
  for (const key of pending) good.add(key);
  while (pending.length) {
    const current = pending.pop();
    for (const edge of edges) {
      if (display(edge, 'to') !== current) continue;
      const from = display(edge, 'from');
      if (!good.has(from)) {
        good.add(from);
        pending.push(from);
      }
    }
  }
  return good;
}

/** Output variable codes that at least one RESULT node writes to. */
/**
 * Códigos de salida que ALGÚN nodo produce.
 *
 * No sólo los nodos de resultado: una salida también se escribe desde una llamada
 * a campo calculado con destino OUTPUT y desde una acción que escribe un campo.
 * Mirar sólo los RESULT hacía que un algoritmo real —con etapas que van dejando
 * su score y su decisión por el camino— acumulara un aviso por cada salida, todos
 * falsos, y ninguno accionable.
 */
function assignedOutputCodes(
  nodes: UnknownRecord[],
  actions: UnknownRecord[] = [],
): { codes: Set<string>; hasScript: boolean } {
  const codes = new Set<string>();
  let hasScript = false;

  // Campo que escribe cada acción del catálogo, por código de acción.
  const fieldByAction = new Map<string, string>();
  for (const action of actions) {
    const field = display(asRecord(action.payload), 'field');
    if (field !== '—') fieldByAction.set(display(action, 'code'), field);
  }

  for (const node of nodes) {
    const config = asRecord(node.config);

    // Acciones que ejecuta el nodo: el destino está en la definición, no aquí.
    for (const binding of asRows(node.actions)) {
      const written = fieldByAction.get(display(binding, 'actionCode', 'code'));
      if (written) codes.add(written);
    }

    // Campos calculados invocados por el nodo, con destino en una salida.
    for (const call of asRows(node.calculatedFieldCalls)) {
      const target = asRecord(call.target);
      if (display(target, 'kind') === 'OUTPUT') {
        const code = display(target, 'code');
        if (code !== '—') codes.add(code);
      }
    }

    // Acción que escribe un campo: `payload.field` es el destino.
    const field = display(config, 'field', 'targetCode');
    if (field !== '—') codes.add(field);

    if (display(node, 'type') !== 'RESULT') continue;
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
export function analyzeFlow({
  nodes,
  edges,
  inputs,
  outputs,
  actions = [],
}: FlowInput): FlowIssue[] {
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

  // The final output need not be declared up front: if a RESULT node exists, the
  // output is inferred from it. Only warn when nothing at all can produce a result.
  const hasResultNode = nodes.some((node) => display(node, 'type') === 'RESULT');
  if (!outputs.length && !hasResultNode) {
    issues.push({
      code: 'NO_OUTPUTS',
      severity: 'warning',
      message:
        'La decisión no produce ningún resultado: añade un nodo Resultado (su salida se toma como resultado final).',
    });
  }

  /*
   * Un árbol concluye en UNA sola conclusión, pero puede publicar cuantos datos de
   * apoyo quiera (el score de cada etapa, el tramo de riesgo, el precio…). Lo que
   * importa es que haya exactamente una salida PRINCIPAL, que es la que responde
   * «¿qué se decidió?».
   *
   * Antes se contaba el total y se pedía «deja solo la principal»: sobre un
   * algoritmo real con 27 salidas legítimas, el consejo era borrar 26 datos que
   * alguien necesita.
   */
  const primaries = outputs.filter((output) =>
    String(output.usageType ?? '').startsWith('OUTPUT_PRIMARY'),
  );
  if (outputs.length && !primaries.length) {
    issues.push({
      code: 'NO_PRIMARY_OUTPUT',
      severity: 'warning',
      message:
        'Ninguna salida está marcada como principal: quien consuma la decisión no sabrá cuál es la conclusión. Marca una con la estrella.',
    });
  }
  if (primaries.length > 1) {
    issues.push({
      code: 'MULTIPLE_PRIMARY_OUTPUTS',
      severity: 'error',
      message: `Hay ${primaries.length} salidas marcadas como principales (${primaries
        .map((output) => display(output, 'code'))
        .join(', ')}). La conclusión sólo puede ser una.`,
    });
  }

  const reached = reachableFromStart(nodes, edges);
  const terminalReach = canReachTerminal(nodes, edges);
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
        severity: 'error',
        message: `El nodo «${display(node, 'label', 'key')}» no es terminal pero no tiene ninguna salida. Todo camino debe terminar en un fin (Resultado/Fin).`,
        nodeKey: key,
      });
    } else if (!isTerminal(node) && hasOutgoing && !terminalReach.has(key)) {
      // Tiene salidas pero ninguna conduce a un fin (p. ej. un bucle): rama rota.
      issues.push({
        code: 'NODE_NO_TERMINAL_PATH',
        severity: 'error',
        message: `Desde el nodo «${display(node, 'label', 'key')}» ningún camino llega a un fin (Resultado/Fin). En un árbol de decisión todo nodo debe conducir a un final.`,
        nodeKey: key,
      });
    }
  }

  // Every declared output should be produced by some RESULT node.
  const { codes: assigned, hasScript } = assignedOutputCodes(nodes, actions);
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
