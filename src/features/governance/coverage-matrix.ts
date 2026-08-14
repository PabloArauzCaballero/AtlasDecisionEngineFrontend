import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Estado de un cruce objetivo × política.
 *
 * `NOT_APPLICABLE` es la celda que NO EXISTE. Una política es un requisito de UN
 * objetivo (`decision_policy_requirement` cuelga de `business_objective_id`),
 * pero la matriz publica una columna por cada código de política del tenant, así
 * que la rejilla es casi toda cruces imposibles. El motor los rellenaba con
 * `GAP` y los contaba en el denominador, y de ahí salía el 0 %: con 27 objetivos
 * de una política cada uno, sólo 27 de las 729 celdas pueden cubrirse jamás, así
 * que un tenant con TODA su evidencia enlazada seguiría leyendo 4 %. Un número
 * que no puede llegar a 100 no mide nada.
 *
 * El motor ya lo dice —emite `NOT_APPLICABLE` y `total` cuenta requisitos—, pero
 * el alcance se sigue derivando aquí: el portal se despliega por su cuenta y
 * tiene que dar la cifra buena también contra un motor todavía sin actualizar.
 */
export type CoverageState = 'COMPLETE' | 'PARTIAL' | 'GAP' | 'NOT_APPLICABLE';

const STATES = new Set<CoverageState>(['COMPLETE', 'PARTIAL', 'GAP', 'NOT_APPLICABLE']);

export interface CoveragePolicy {
  id: string;
  policyCode: string;
}

export interface CoverageRow {
  id: string;
  objectiveCode: string;
  name: string;
  /** Un estado por política, en el mismo orden que `policies`. */
  cells: CoverageState[];
}

export interface CoverageMatrix {
  policies: CoveragePolicy[];
  rows: CoverageRow[];
  complete: number;
  partial: number;
  gaps: number;
  /** Celdas que son un requisito de verdad: el denominador honesto. */
  required: number;
  pct: number;
  /**
   * `false` cuando no se pudo saber qué política pertenece a qué objetivo y hay
   * que contar la rejilla entera. La vista lo dice en voz alta en vez de
   * publicar un porcentaje que no significa lo que parece.
   */
  scoped: boolean;
}

/** Qué políticas exige cada objetivo, por id de objetivo. */
export type PolicyScopes = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Deriva el alcance desde el listado de objetivos, que sí trae
 * `policyRequirements`. La matriz no lo trae: pierde a quién pertenece cada
 * columna al fusionar los códigos en un único encabezado.
 */
export function policyScopes(objectives: readonly UnknownRecord[]): PolicyScopes {
  const scopes = new Map<string, Set<string>>();
  for (const objective of objectives) {
    const codes = asRows(objective.policyRequirements)
      .map((requirement) => String(requirement.policyCode ?? ''))
      .filter(Boolean);
    scopes.set(display(objective, 'id'), new Set(codes));
  }
  return scopes;
}

function cellState(links: UnknownRecord, policyCode: string): CoverageState {
  const raw = String(links[policyCode] ?? 'GAP').toUpperCase() as CoverageState;
  return STATES.has(raw) ? raw : 'GAP';
}

/**
 * Arma la matriz contando sólo los cruces que un auditor podría exigir.
 *
 * Si `scopes` no cubre TODOS los objetivos de la matriz se descarta entero y se
 * cuenta la rejilla completa. Un alcance a medias escondería como «no aplica»
 * huecos reales del objetivo que faltaba, que es el único error que esta
 * pantalla no se puede permitir: prefiere sobrar un hueco a callarlo.
 */
export function buildCoverageMatrix(payload: unknown, scopes: PolicyScopes | null): CoverageMatrix {
  const root = asRecord(payload);
  const policies = asRows(root.policies).map((policy) => ({
    id: display(policy, 'id'),
    policyCode: display(policy, 'policyCode'),
  }));
  const objectives = asRows(root.objectives);
  const scoped =
    Boolean(scopes) && objectives.every((objective) => scopes?.has(display(objective, 'id')));

  let complete = 0;
  let partial = 0;
  let gaps = 0;
  const rows = objectives.map((objective) => {
    const links = asRecord(objective.coverage);
    const scope = scoped ? scopes?.get(display(objective, 'id')) : undefined;
    const cells = policies.map((policy): CoverageState => {
      if (scope && !scope.has(policy.policyCode)) return 'NOT_APPLICABLE';
      const state = cellState(links, policy.policyCode);
      if (state === 'COMPLETE') complete += 1;
      else if (state === 'PARTIAL') partial += 1;
      else if (state === 'GAP') gaps += 1;
      return state;
    });
    return {
      id: display(objective, 'id'),
      objectiveCode: display(objective, 'objectiveCode'),
      name: display(objective, 'name'),
      cells,
    };
  });

  const required = complete + partial + gaps;
  return {
    policies,
    rows,
    complete,
    partial,
    gaps,
    required,
    pct: required ? Math.round((complete / required) * 100) : 0,
    scoped,
  };
}
