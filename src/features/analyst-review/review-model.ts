import { astToText } from '../graph-editor/json-ast';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Lo que un analista necesita leer para firmar una versión: qué hace cada paso, por qué y
 * qué pasó en las pruebas.
 *
 * La revisión de seguridad enseñaba hallazgos, nodos de script y subárboles —casi siempre
 * vacíos— y nada de lo que decide el artefacto. Quien tenía que aprobar `RIESGO_ONBOARDING_CLIENTE`
 * veía «Sin hallazgos», «Esta versión no ejecuta nodos de script» y una lista de variables, y
 * tenía que ir al editor del grafo a adivinar el resto. Aquí todo sale del grafo compilado y de
 * las corridas que el propio Motor guarda: no se inventa ninguna explicación.
 */

export interface StepExit {
  to: string;
  when: string;
}

export interface ReviewStep {
  key: string;
  label: string;
  kind: string;
  why: string[];
  exits: StepExit[];
}

const KIND: Record<string, string> = {
  START: 'Inicio',
  EXPRESSION: 'Cálculo',
  CONDITION: 'Bifurcación',
  ACTION: 'Anota un motivo',
  MANUAL_REVIEW: 'Pasa a una persona',
  RESULT: 'Resultado',
  REFERENCE: 'Llama a otro artefacto',
  SCRIPT: 'Script',
  END: 'Fin',
};

function literalText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return typeof value === 'object' ? astToText(value) : String(value);
}

function assignmentText(row: UnknownRecord): string {
  const target = display(row, 'outputCode', 'code', 'target');
  const value =
    row.expression !== undefined ? astToText(row.expression) : literalText(row.value ?? row.source);
  return `${target} = ${value}`;
}

function actionReasons(node: UnknownRecord, graph: UnknownRecord): string[] {
  const catalog = new Map(asRows(graph.actions).map((action) => [String(action.code), action]));
  return asRows(node.actions).flatMap((ref) => {
    const action = catalog.get(String(ref.code));
    const reasons = asRows(action?.reasonCodes);
    if (!reasons.length) return [`Ejecuta la acción ${display(ref, 'code')}.`];
    return reasons.map((reason) => {
      const publico = display(reason, 'publicMessage');
      const interno = display(reason, 'internalMessage');
      const partes = [`Anota el motivo ${display(reason, 'code')}`];
      if (publico !== '—') partes.push(`al cliente: «${publico}»`);
      if (interno !== '—') partes.push(`internamente: «${interno}»`);
      return `${partes.join(' — ')}.`;
    });
  });
}

function nodeWhy(node: UnknownRecord, graph: UnknownRecord): string[] {
  const config = asRecord(node.config);
  const type = String(node.type ?? '');
  const why: string[] = [];
  for (const row of asRows(config.intermediateAssignments))
    why.push(`Calcula ${assignmentText(row)}.`);
  if (type === 'ACTION') why.push(...actionReasons(node, graph));
  if (type === 'MANUAL_REVIEW') {
    const evidence = asRecord(config.evidence);
    const motivo = display(evidence, 'motivo', 'reason');
    why.push(
      motivo === '—'
        ? 'Detiene la decisión automática y deja el caso a una persona.'
        : `Detiene la decisión automática y deja el caso a una persona con motivo ${motivo}.`,
    );
    const campos = Object.keys(evidence).filter((key) => key !== 'motivo');
    if (campos.length) why.push(`La persona recibe como evidencia: ${campos.join(', ')}.`);
  }
  for (const row of asRows(config.assignments)) why.push(`Fija ${assignmentText(row)}.`);
  return why;
}

function conditionText(ref: UnknownRecord, catalog: Map<string, UnknownRecord>): string {
  const condition = catalog.get(String(ref.code));
  if (!condition) return display(ref, 'code');
  const name = display(condition, 'name');
  const expression = astToText(condition.expression);
  return expression ? `${name} (${expression})` : name;
}

/** Los pasos en el orden en que se recorren desde el inicio; los inalcanzables, al final. */
export function orderedSteps(graph: unknown): ReviewStep[] {
  const record = asRecord(graph);
  const nodes = asRows(record.nodes);
  const edges = asRows(record.edges);
  const byKey = new Map(nodes.map((node) => [String(node.key), node]));
  const conditions = new Map(asRows(record.conditions).map((row) => [String(row.code), row]));
  const label = (key: string) => {
    const text = display(byKey.get(key) ?? {}, 'label');
    return text === '—' ? key : text;
  };

  const salidas = (key: string) =>
    edges
      .filter((edge) => String(edge.from) === key)
      .sort((a, b) => Number(Boolean(a.default)) - Number(Boolean(b.default)));

  const start = nodes.find((node) => node.type === 'START') ?? nodes[0];
  const visitados: string[] = [];
  const cola = start ? [String(start.key)] : [];
  while (cola.length) {
    const key = cola.shift() as string;
    if (visitados.includes(key) || !byKey.has(key)) continue;
    visitados.push(key);
    for (const edge of salidas(key)) cola.push(String(edge.to));
  }
  for (const node of nodes)
    if (!visitados.includes(String(node.key))) visitados.push(String(node.key));

  return visitados.map((key) => {
    const node = byKey.get(key) as UnknownRecord;
    const propias = salidas(key);
    const exits = propias.map((edge) => {
      const refs = asRows(edge.conditions);
      let when = 'Siempre';
      if (refs.length) when = refs.map((ref) => conditionText(ref, conditions)).join(' y ');
      else if (edge.default && propias.length > 1) when = 'En cualquier otro caso';
      return { to: label(String(edge.to)), when };
    });
    return {
      key,
      label: label(key),
      kind: KIND[String(node.type)] ?? String(node.type ?? '—'),
      why: nodeWhy(node, record),
      exits,
    };
  });
}

export interface CaseRunRow {
  code: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  path: string[];
  error: string | null;
}

/** Cada caso de una corrida: lo esperado, lo obtenido y el camino que tomó por el grafo. */
export function caseRunRows(run: unknown, graph: unknown): CaseRunRow[] {
  const labels = new Map(
    asRows(asRecord(graph).nodes).map((node) => [String(node.key), display(node, 'label')]),
  );
  return asRows(asRecord(run).caseRuns).map((caseRun) => {
    const testCase = asRecord(caseRun.testCase);
    const actual = asRecord(caseRun.actualResultJson);
    const expected = asRecord(testCase.expectedResultJson);
    const trace = asRecord(actual.trace);
    const error = caseRun.errorJson ? JSON.stringify(caseRun.errorJson) : null;
    return {
      code: display(testCase, 'caseCode'),
      name: display(testCase, 'testName'),
      passed: String(caseRun.resultStatus) === 'PASS',
      expected: display(expected, 'outcome'),
      actual: display(actual, 'outcome'),
      path: (Array.isArray(trace.nodes) ? (trace.nodes as unknown[]) : []).map(
        (key) => labels.get(String(key)) ?? String(key),
      ),
      error,
    };
  });
}
