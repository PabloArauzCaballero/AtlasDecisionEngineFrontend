import type { DataType } from '../../contracts/data-types';
import type { VariableConstraints } from '../../contracts/constraints';

/** Modalidades de implementación (§6). */
export const IMPLEMENTATION_KINDS = ['OPERATION', 'JAVASCRIPT', 'PYTHON'] as const;
export type ImplementationKind = (typeof IMPLEMENTATION_KINDS)[number];

export const IMPLEMENTATION_LABELS: Readonly<Record<ImplementationKind, string>> = {
  OPERATION: 'Constructor visual',
  JAVASCRIPT: 'Expresión JavaScript',
  PYTHON: 'Expresión Python',
};

/** Políticas ante datos que impiden calcular (§5.3). */
export const ERROR_POLICIES = ['FAIL', 'RETURN_NULL', 'RETURN_DEFAULT'] as const;
export type ErrorPolicy = (typeof ERROR_POLICIES)[number];

export const ERROR_POLICY_LABELS: Readonly<Record<ErrorPolicy, string>> = {
  FAIL: 'Fallar con el código de error declarado',
  RETURN_NULL: 'Devolver sin valor',
  RETURN_DEFAULT: 'Devolver el valor por defecto',
};

export interface CalculatedFieldInput {
  id: string;
  name: string;
  description: string;
  dataType: DataType;
  required: boolean;
  constraints?: VariableConstraints;
  defaultValue?: unknown;
}

export interface CalculatedFieldReturn {
  dataType: DataType;
  nullable: boolean;
  constraints?: VariableConstraints;
  precision?: number;
  nullConditions: string[];
  divisionByZero: ErrorPolicy;
  missingData: ErrorPolicy;
  outOfRange: ErrorPolicy;
  errorCode: string;
  description?: string;
}

export interface CalculatedFieldComments {
  overview?: string;
  functional?: string;
  inputsExplained?: string;
  outputExplained?: string;
  assumptions?: string[];
  limitations?: string[];
  example?: string;
  rationale?: string;
}

/** Nodo del árbol del constructor visual. */
export type OperationArg = OperationNode | { literal: unknown } | { input: string };

export interface OperationNode {
  operation: string;
  args: OperationArg[];
}

export interface CalculatedFieldDraft {
  implementationKind: ImplementationKind;
  inputs: CalculatedFieldInput[];
  returns: CalculatedFieldReturn;
  comments: CalculatedFieldComments;
  operation?: OperationNode;
  sourceCode?: string;
  libraryIds: string[];
  environment?: string;
  timeoutMs?: number;
}

export const MAX_EXECUTABLE_LINES = 3;

/** Cuenta las líneas ejecutables igual que el backend: sin vacías ni comentarios (§6.2). */
export function countExecutableLines(source: string, language: ImplementationKind): number {
  const prefix = language === 'PYTHON' ? '#' : '//';
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(prefix)).length;
}

/**
 * Traduce el borrador de la UI al cuerpo que espera la API al crear una versión.
 *
 * Vive aquí y no en una página porque lo usan los DOS caminos que publican una
 * versión: el alta de un campo nuevo y la creación de versiones sobre uno que ya
 * existe. Duplicarlo era garantizar que un día divergieran.
 */
export function toVersionPayload(draft: CalculatedFieldDraft): Record<string, unknown> {
  return {
    implementationKind: draft.implementationKind,
    inputs: draft.inputs,
    returns: draft.returns,
    comments: draft.comments,
    operation: draft.operation,
    sourceCode: draft.sourceCode,
    libraryIds: draft.libraryIds,
    environment: draft.environment,
    timeoutMs: draft.timeoutMs,
  };
}

export function emptyDraft(): CalculatedFieldDraft {
  return {
    implementationKind: 'OPERATION',
    inputs: [],
    returns: {
      dataType: 'DECIMAL',
      nullable: false,
      nullConditions: [],
      divisionByZero: 'FAIL',
      missingData: 'FAIL',
      outOfRange: 'FAIL',
      errorCode: 'CALCULATION_FAILED',
    },
    comments: {},
    libraryIds: [],
  };
}
