/**
 * Borrador del contrato de una variable y su traducción a la API.
 *
 * Separado del formulario porque es la forma del dato, no de la pantalla: la usan el
 * editor, la página de contrato y sus pruebas sin montar React.
 */
import type { VariableConstraints } from '../../contracts/constraints';
import type { UnknownRecord } from '../../utils/records';

export interface VariableContractDraft {
  dataType: string;
  displayName: string;
  description: string;
  nullable: boolean;
  defaultValue?: unknown;
  constraints?: VariableConstraints;
  validationMessage: string;
  exampleValid: string;
  exampleInvalid: string;
  expectedOrigin: string;
  sensitivityClass: string;
}

/** Traduce el borrador a lo que espera la API, interpretando los ejemplos escritos. */
export function toPayload(draft: VariableContractDraft): UnknownRecord {
  return {
    dataType: draft.dataType,
    nullable: draft.nullable,
    defaultValue: draft.defaultValue,
    constraints: draft.constraints ?? {},
    displayName: draft.displayName || undefined,
    description: draft.description || undefined,
    validationMessage: draft.validationMessage || undefined,
    exampleValid: draft.exampleValid ? parseSample(draft.exampleValid) : undefined,
    exampleInvalid: draft.exampleInvalid ? parseSample(draft.exampleInvalid) : undefined,
    expectedOrigin: draft.expectedOrigin,
    sources: [],
    validationRules: [],
  };
}

function parseSample(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function emptyContractDraft(): VariableContractDraft {
  return {
    dataType: 'DECIMAL',
    displayName: '',
    description: '',
    nullable: false,
    validationMessage: '',
    exampleValid: '',
    exampleInvalid: '',
    expectedOrigin: 'REQUEST',
    sensitivityClass: 'INTERNAL',
  };
}
