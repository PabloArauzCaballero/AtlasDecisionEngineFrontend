import { asRows, resolvePath, type UnknownRecord } from '../../utils/records';

function pick(record: UnknownRecord, ...paths: string[]): unknown {
  return paths
    .map((path) => resolvePath(record, path))
    .find((value) => value !== null && value !== undefined && value !== '');
}

/**
 * Una variable resuelta tal como la guarda `decision_execution_variable`: el código
 * y la sensibilidad viven en `variableVersion.definition`, y el origen en
 * `sourceCode`. Sin subirlos a la raíz, la tabla pintaba «—» en el nombre y el
 * origen, y —peor— el enmascarado no reconocía ninguna variable como sensible y
 * mostraba los datos personales en claro.
 */
function flattenVariable(item: UnknownRecord): UnknownRecord {
  return {
    ...item,
    variableCode: pick(item, 'variableCode', 'variableVersion.definition.variableCode', 'code'),
    sensitive: pick(item, 'sensitive', 'variableVersion.definition.isSensitive'),
    sensitivityClass: pick(item, 'sensitivityClass', 'variableVersion.definition.sensitivityClass'),
    sourceType: pick(item, 'sourceType', 'source', 'sourceCode'),
  };
}

/**
 * Un paso de `decision_execution_step`: clave y tipo en `node`, y el estado de
 * variables del nodo (§3.1) dentro de `evaluationResultJson`.
 */
function flattenStep(step: UnknownRecord): UnknownRecord {
  return {
    ...step,
    nodeKey: pick(step, 'nodeKey', 'node.nodeKey'),
    nodeType: pick(step, 'nodeType', 'node.nodeType'),
    variableState: pick(step, 'variableState', 'evaluationResultJson.variableState'),
  };
}

/**
 * `GET /v1/audit/executions/:id` devuelve la fila de `decision_execution` con sus
 * relaciones anidadas y los nombres reales de columna (`decisionStatus`,
 * `businessOutcome`, `inputSnapshotJson`). Esto la aplana a los nombres que pinta
 * el detalle, sin pisar un campo plano si el backend lo envía así.
 */
export function flattenExecution(raw: UnknownRecord): UnknownRecord {
  const steps = asRows(raw.traceSteps ?? raw.trace ?? raw.steps).map(flattenStep);
  return {
    ...raw,
    artifactCode: pick(raw, 'artifactCode', 'artifactVersion.artifact.artifactCode'),
    versionNumber: pick(raw, 'versionNumber', 'artifactVersion.versionNumber'),
    environmentCode: pick(raw, 'environmentCode', 'deployment.environment.code'),
    status: pick(raw, 'status', 'decisionStatus'),
    outcome: pick(raw, 'outcome', 'businessOutcome'),
    createdAt: pick(raw, 'createdAt', 'executedAt'),
    inputJson: pick(raw, 'inputJson', 'inputSnapshotJson', 'inputSnapshot'),
    variables: asRows(raw.variables).map(flattenVariable),
    traceSteps: steps,
  };
}
