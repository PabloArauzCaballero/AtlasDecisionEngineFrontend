import type { CodeImportIssue } from '../../components/CodeImportIssuesList';
import { dataTypeLabel, normalizeDataType } from '../../contracts/data-types';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

export interface DeclaredVariable {
  code: string;
  /** `INPUT`, `OUTPUT` u `OUTPUT_PRIMARY`, tal y como lo devuelve el análisis. */
  usageType: string;
  /** Tipo declarado en el contrato del archivo. */
  dataType: string;
}

export interface CatalogMatch {
  /** Fila del catálogo con el MISMO código. Ausente si no existe. */
  found?: { definitionId: string; name: string; dataType: string };
  /** Código del catálogo que sólo difiere en mayúsculas/minúsculas. */
  similar?: string;
}

/**
 * Avisos del motor que nacen del CATÁLOGO, no del código pegado.
 *
 * Se apartan del resto por dos motivos. Uno: no deben ocultar la vista previa del
 * grafo —para declarar bien una variable hay que poder ver qué pide el algoritmo—
 * aunque impidan guardarlo. Dos: la comprobación local dice lo mismo mejor (en
 * español, con el papel de la variable, en su línea del contrato y con enlace al
 * catálogo), así que se enseña una sola vez, y sólo se cede al mensaje del motor
 * cuando la comprobación local no llegó a hacerse.
 */
export const ENGINE_CATALOG_ISSUE_CODES: ReadonlySet<string> = new Set([
  'CODE_IMPORT_VARIABLE_NOT_IN_CATALOG',
  'CODE_IMPORT_VARIABLE_TYPE_MISMATCH',
]);

/** Dónde aparece un texto en el código, para señalar la línea en vez de decir «línea 1». */
export type Locate = (needle: string) => number;

export function locateIn(source: string): Locate {
  const lines = source.split('\n');
  return (needle) => {
    const index = lines.findIndex((line) => line.includes(needle));
    return index === -1 ? 1 : index + 1;
  };
}

/** Variables que el contrato declara, leídas de las dependencias del grafo generado. */
export function declaredVariables(dependencies: UnknownRecord[]): DeclaredVariable[] {
  return dependencies
    .map((dependency) => ({
      code: display(dependency, 'variableCode'),
      usageType: display(dependency, 'usageType'),
      dataType: display(dependency, 'dataType'),
    }))
    .filter((variable) => variable.code !== '—');
}

/**
 * Valores de texto que cada salida recibe literalmente en alguna rama.
 *
 * Son los candidatos a código de salida: lo que el motor escribirá tal cual en el
 * resultado si nadie los ha declarado.
 */
export function assignedLiterals(nodes: UnknownRecord[]): Map<string, string[]> {
  const byOutput = new Map<string, string[]>();
  for (const node of nodes) {
    if (display(node, 'type') !== 'RESULT') continue;
    for (const assignment of asRows(asRecord(node.config).assignments)) {
      const value = assignment.value;
      if (typeof value !== 'string' || !value.trim()) continue;
      const outputCode = display(assignment, 'outputCode');
      const values = byOutput.get(outputCode) ?? [];
      if (!values.includes(value)) values.push(value);
      byOutput.set(outputCode, values);
    }
  }
  return byOutput;
}

const USAGE_LABELS: Readonly<Record<string, string>> = {
  INPUT: 'entrada',
  OUTPUT: 'salida',
  OUTPUT_PRIMARY: 'salida principal',
};

/** Cada variable declarada, contra el catálogo del inventario. */
export function variableIssues(
  declared: DeclaredVariable[],
  matches: ReadonlyMap<string, CatalogMatch>,
  locate: Locate,
): CodeImportIssue[] {
  const issues: CodeImportIssue[] = [];
  for (const variable of declared) {
    const match = matches.get(variable.code);
    if (!match) continue;
    const role = USAGE_LABELS[variable.usageType] ?? 'variable';
    const line = locate(`"${variable.code}"`);
    if (!match.found) {
      issues.push(
        issue(
          'CODE_IMPORT_VARIABLE_NOT_IN_CATALOG',
          line,
          match.similar
            ? `La ${role} «${variable.code}» no existe en el inventario; el catálogo sí tiene «${match.similar}».`
            : `La ${role} «${variable.code}» no existe en el inventario de variables.`,
        ),
      );
      if (match.similar) {
        issues.push(
          issue(
            'CODE_IMPORT_VARIABLE_CASE_MISMATCH',
            line,
            `«${variable.code}» y «${match.similar}» sólo se diferencian en mayúsculas: para el motor son dos variables distintas.`,
          ),
        );
      }
      continue;
    }
    const declaredType = normalizeDataType(variable.dataType);
    const catalogType = normalizeDataType(match.found.dataType);
    if (declaredType !== catalogType) {
      issues.push(
        issue(
          'CODE_IMPORT_VARIABLE_TYPE_MISMATCH',
          line,
          `La ${role} «${variable.code}» se declara como ${dataTypeLabel(variable.dataType)} y el catálogo la tiene como ${dataTypeLabel(match.found.dataType)}.`,
        ),
      );
    }
  }
  return issues;
}

/** Códigos de salida (motivos) que el código escribe, contra el catálogo de motivos. */
export function reasonIssues(
  reasonOutputId: string | undefined,
  literals: readonly string[],
  known: ReadonlyMap<string, boolean>,
  locate: Locate,
): CodeImportIssue[] {
  if (!reasonOutputId) {
    return [
      issue(
        'CODE_IMPORT_REASON_OUTPUT_UNDECLARED',
        1,
        'El contrato no declara `reasonOutputId`: no se puede comprobar contra el catálogo qué valores son códigos de salida.',
        'WARNING',
      ),
    ];
  }
  return literals
    .filter((literal) => known.get(literal) === false)
    .map((literal) =>
      issue(
        'CODE_IMPORT_REASON_CODE_NOT_IN_CATALOG',
        locate(`"${literal}"`),
        `El motivo «${literal}» que escribe la salida «${reasonOutputId}» no está en el catálogo de motivos.`,
      ),
    );
}

/** Valores literales contra la lista de valores permitidos que declara el catálogo. */
export function allowedValueIssues(
  literalsByOutput: ReadonlyMap<string, string[]>,
  allowedByOutput: ReadonlyMap<string, unknown[]>,
  locate: Locate,
): CodeImportIssue[] {
  const issues: CodeImportIssue[] = [];
  for (const [outputCode, allowed] of allowedByOutput) {
    if (!allowed.length) continue;
    for (const literal of literalsByOutput.get(outputCode) ?? []) {
      if (allowed.some((candidate) => candidate === literal)) continue;
      issues.push(
        issue(
          'CODE_IMPORT_VALUE_NOT_ALLOWED',
          locate(`"${literal}"`),
          `«${literal}» no está entre los valores que el catálogo permite para «${outputCode}» (${allowed.map(String).join(', ')}).`,
        ),
      );
    }
  }
  return issues;
}

function issue(
  code: string,
  line: number,
  message: string,
  severity: 'ERROR' | 'WARNING' = 'ERROR',
): CodeImportIssue {
  return { source: 'INVENTARIO', severity, line, message, code };
}
