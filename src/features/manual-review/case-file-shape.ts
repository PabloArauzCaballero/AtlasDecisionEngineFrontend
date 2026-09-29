/**
 * La forma REAL de `GET /v1/audit/executions/:id`, aplanada para el expediente del caso.
 *
 * El panel leía campos que la API no manda en primer nivel: `variableCode` y `sensitivityClass`
 * viven en `variableVersion.definition`, la entrada en `inputSnapshotJson`, el código del motivo en
 * `reasonCode.reasonCode`, el artefacto en `artifactVersion.artifact`. Con eso la tabla «Datos del
 * solicitante» salía con la columna Variable en «—», la «Entrada original» vacía, y —lo peor— el
 * enmascarado no veía la clasificación y pintaba en claro los datos personales. Se aceptan también
 * las claves planas, que es la forma que usan los dobles de prueba y cualquier proxy que ya aplane.
 */
import { asRows, resolvePath, type UnknownRecord } from '../../utils/records';

function first(record: UnknownRecord, paths: readonly string[]): unknown {
  for (const path of paths) {
    const value = resolvePath(record, path);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
}

export interface CaseFileVariable extends UnknownRecord {
  id: unknown;
  variableCode: unknown;
  valueJson: unknown;
  sensitivityClass: unknown;
  sensitive: boolean;
  source: unknown;
}

export function caseFileVariables(execution: UnknownRecord): CaseFileVariable[] {
  return asRows(execution.variables).map((row) => {
    const sensitivityClass = first(row, [
      'sensitivityClass',
      'variableVersion.definition.sensitivityClass',
    ]);
    return {
      id: row.id,
      variableCode: first(row, [
        'variableCode',
        'variableVersion.definition.variableCode',
        'variableVersion.code',
        'name',
      ]),
      valueJson: row.valueJson ?? row.value,
      sensitivityClass,
      sensitive:
        row.sensitive === true ||
        resolvePath(row, 'variableVersion.definition.isSensitive') === true,
      source: first(row, ['sourceType', 'source', 'sourceCode']),
    };
  });
}

export function caseFileReasons(
  execution: UnknownRecord,
): Array<{ code: string; message: string }> {
  return asRows(execution.reasonCodes ?? execution.reasons).map((row) => {
    const code = first(row, ['reasonCode.reasonCode', 'reasonCode.code', 'reasonCode', 'code']);
    const message = first(row, [
      'publicMessage',
      'renderedMessage',
      'reasonCode.publicMessage',
      'message',
      'description',
    ]);
    return {
      code: typeof code === 'string' ? code : '—',
      message: typeof message === 'string' ? message : '—',
    };
  });
}

/** Los datos de cabecera del expediente, con las rutas anidadas que devuelve la API. */
export function caseFileSummary(execution: UnknownRecord): UnknownRecord {
  return {
    subject: first(execution, ['subjectReference', 'principalId', 'subjectReferenceHash']),
    requestId: execution.requestId,
    artifactCode: first(execution, ['artifactCode', 'artifactVersion.artifact.artifactCode']),
    version: first(execution, [
      'versionNumber',
      'semanticVersion',
      'artifactVersion.semanticVersion',
      'artifactVersion.versionNumber',
    ]),
    environment: first(execution, ['environmentCode', 'deployment.environment.code']),
    outcome: first(execution, ['outcome', 'businessOutcome']),
    executedAt: first(execution, ['executedAt', 'createdAt']),
  };
}

export function caseFileInput(execution: UnknownRecord): unknown {
  return execution.inputSnapshotJson ?? execution.inputJson ?? execution.inputSnapshot ?? {};
}
