import { describe, expect, it } from 'vitest';
import {
  buildReferenceBody,
  emptyReferenceForm,
  outputAssignmentsOf,
  referenceErrors,
  type ReferenceFormState,
} from './reference-authoring';

function validForm(): ReferenceFormState {
  return {
    childArtifactId: 'art_child',
    childArtifactVersionId: 'ver_child',
    inputMappings: [{ childVariableCode: 'income', source: 'VARIABLE', path: 'monthlyIncome' }],
    outputMap: { score: 'childScore' },
    onErrorPolicy: 'FAIL',
  };
}

describe('reference-authoring', () => {
  it('accepts a complete, valid reference form', () => {
    expect(referenceErrors('RESULT_1', validForm())).toEqual([]);
  });

  it('requires a hosting node key', () => {
    expect(referenceErrors('', validForm())).toContain(
      'Selecciona primero el nodo de resultado que aloja la referencia.',
    );
  });

  it('requires child artifact and version', () => {
    const form = emptyReferenceForm();
    form.outputMap = { score: 'childScore' };
    const errors = referenceErrors('RESULT_1', form);
    expect(errors).toContain('Elige el algoritmo (artefacto) a referenciar.');
    expect(errors).toContain('Elige la versión del algoritmo referenciado.');
  });

  it('requires at least one output mapping', () => {
    const form = validForm();
    form.outputMap = {};
    expect(referenceErrors('RESULT_1', form)).toContain(
      'Mapea al menos una salida del algoritmo referenciado a una salida de este flujo.',
    );
  });

  it('rejects an invalid child output code', () => {
    const form = validForm();
    form.outputMap = { score: '9bad code' };
    expect(referenceErrors('RESULT_1', form).some((error) => error.includes('9bad code'))).toBe(
      true,
    );
  });

  it('requires a path when an input mapping reads a variable', () => {
    const form = validForm();
    form.inputMappings = [{ childVariableCode: 'income', source: 'VARIABLE', path: '' }];
    expect(referenceErrors('RESULT_1', form).some((error) => error.includes('income'))).toBe(true);
  });

  it('builds the DTO with a deduped output allowlist', () => {
    const form = validForm();
    form.outputMap = { score: 'childScore', band: 'childScore', extra: 'childBand' };
    const body = buildReferenceBody('RESULT_1', form);
    expect(body.outputMapping).toEqual([
      { childOutputCode: 'childScore' },
      { childOutputCode: 'childBand' },
    ]);
    expect(body.nodeKey).toBe('RESULT_1');
    expect(body.inputMapping[0]).toEqual({
      childVariableCode: 'income',
      source: 'VARIABLE',
      path: 'monthlyIncome',
    });
  });

  it('derives the node output assignments from the map, ignoring blanks', () => {
    const form = validForm();
    form.outputMap = { score: 'childScore', band: '  ' };
    expect(outputAssignmentsOf(form)).toEqual([
      { outputCode: 'score', childOutputCode: 'childScore' },
    ]);
  });

  it('keeps literal input mappings intact', () => {
    const form = validForm();
    form.inputMappings = [{ childVariableCode: 'threshold', source: 'LITERAL', value: 700 }];
    const body = buildReferenceBody('RESULT_1', form);
    expect(body.inputMapping[0]).toEqual({
      childVariableCode: 'threshold',
      source: 'LITERAL',
      value: 700,
    });
  });
});
