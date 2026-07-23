/**
 * Pure builders/validators for a RESULT node's "reference another algorithm"
 * (nested decision tree, Fase 7). Mirrors the backend CreateArtifactReferenceDto
 * so the UI can assemble a valid payload and the node's own `outputAssignments`
 * without a round trip. Kept side-effect free for unit testing.
 */

export type ReferenceSource = 'VARIABLE' | 'LITERAL';
export type OnErrorPolicy = 'FAIL' | 'FALLBACK' | 'SKIP';

export interface InputMappingEntry {
  childVariableCode: string;
  source: ReferenceSource;
  path?: string;
  value?: unknown;
}

export interface OutputMappingEntry {
  childOutputCode: string;
}

export interface CreateReferenceBody {
  nodeKey: string;
  childArtifactId: string;
  childArtifactVersionId: string;
  inputMapping: InputMappingEntry[];
  outputMapping: OutputMappingEntry[];
  onErrorPolicy: OnErrorPolicy;
}

export interface ReferenceFormState {
  childArtifactId: string;
  childArtifactVersionId: string;
  inputMappings: InputMappingEntry[];
  /** parent output code -> child output code that feeds it. */
  outputMap: Record<string, string>;
  onErrorPolicy: OnErrorPolicy;
}

/** Same identifier shape the backend enforces on child variable/output codes. */
export const REFERENCE_CODE_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,159}$/;

export function emptyReferenceForm(): ReferenceFormState {
  return {
    childArtifactId: '',
    childArtifactVersionId: '',
    inputMappings: [],
    outputMap: {},
    onErrorPolicy: 'FAIL',
  };
}

/** Non-empty (parentOutputCode, childOutputCode) pairs the author has mapped. */
function mappedOutputs(state: ReferenceFormState): Array<[string, string]> {
  return Object.entries(state.outputMap)
    .map(([parent, child]) => [parent, child.trim()] as [string, string])
    .filter(([, child]) => child !== '');
}

/**
 * The node's own config assignments: which child output feeds each of the
 * parent's declared outputs. Stored on the RESULT node (mode=REFERENCE).
 */
export function outputAssignmentsOf(
  state: ReferenceFormState,
): Array<{ outputCode: string; childOutputCode: string }> {
  return mappedOutputs(state).map(([outputCode, childOutputCode]) => ({
    outputCode,
    childOutputCode,
  }));
}

/** Human-readable blocking problems; empty array means the draft is submittable. */
export function referenceErrors(nodeKey: string, state: ReferenceFormState): string[] {
  const errors: string[] = [];
  if (!nodeKey.trim())
    errors.push('Selecciona primero el nodo de resultado que aloja la referencia.');
  if (!state.childArtifactId.trim()) errors.push('Elige el algoritmo (artefacto) a referenciar.');
  if (!state.childArtifactVersionId.trim())
    errors.push('Elige la versión del algoritmo referenciado.');

  const outputs = mappedOutputs(state);
  if (!outputs.length) {
    errors.push('Mapea al menos una salida del algoritmo referenciado a una salida de este flujo.');
  }
  for (const [, child] of outputs) {
    if (!REFERENCE_CODE_RE.test(child)) {
      errors.push(`El código de salida del hijo «${child}» no tiene un formato válido.`);
    }
  }

  for (const entry of state.inputMappings) {
    if (!REFERENCE_CODE_RE.test(entry.childVariableCode)) {
      errors.push(
        `La variable de entrada del hijo «${entry.childVariableCode || '(vacía)'}» no es válida.`,
      );
    }
    if (entry.source === 'VARIABLE' && !String(entry.path ?? '').trim()) {
      errors.push(`Indica de qué variable del flujo se alimenta «${entry.childVariableCode}».`);
    }
  }
  return errors;
}

/** Assembles the CreateArtifactReferenceDto payload from validated form state. */
export function buildReferenceBody(
  nodeKey: string,
  state: ReferenceFormState,
): CreateReferenceBody {
  const outputCodes = [...new Set(mappedOutputs(state).map(([, child]) => child))];
  return {
    nodeKey,
    childArtifactId: state.childArtifactId.trim(),
    childArtifactVersionId: state.childArtifactVersionId.trim(),
    inputMapping: state.inputMappings.map((entry) =>
      entry.source === 'VARIABLE'
        ? {
            childVariableCode: entry.childVariableCode.trim(),
            source: 'VARIABLE',
            path: String(entry.path ?? '').trim(),
          }
        : {
            childVariableCode: entry.childVariableCode.trim(),
            source: 'LITERAL',
            value: entry.value,
          },
    ),
    outputMapping: outputCodes.map((childOutputCode) => ({ childOutputCode })),
    onErrorPolicy: state.onErrorPolicy,
  };
}
