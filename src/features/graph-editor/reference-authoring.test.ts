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
    ...emptyReferenceForm(),
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

  // --- §9: el resto de la política de la referencia ---

  it('por defecto fija la versión exacta y no reintenta', () => {
    // Reintentar por defecto haría que una decisión repitiera sola algo que puede
    // tener efectos; y resolver «la activa» rompería la reproducibilidad.
    const form = emptyReferenceForm();
    expect(form.versionSelection).toBe('EXACT');
    expect(form.maxRetries).toBe(0);
    expect(form.isRequired).toBe(true);
    expect(form.tracePolicy).toBe('FULL');
  });

  it('rechaza resolver la versión activa cuando el ambiente es PROD', () => {
    const form = {
      ...validForm(),
      versionSelection: 'ACTIVE_IN_ENVIRONMENT' as const,
      environmentCode: 'prod',
    };
    expect(referenceErrors('RESULT_1', form).join(' ')).toContain('versión exacta');
  });

  it('permite resolver la versión activa fuera de PROD', () => {
    const form = {
      ...validForm(),
      versionSelection: 'ACTIVE_IN_ENVIRONMENT' as const,
      environmentCode: 'DEV',
    };
    expect(referenceErrors('RESULT_1', form)).toEqual([]);
  });

  it('rechaza una referencia opcional que igualmente falla la decisión', () => {
    const form = { ...validForm(), isRequired: false, onErrorPolicy: 'FAIL' as const };
    expect(referenceErrors('RESULT_1', form).join(' ')).toContain('no puede fallar la decisión');
  });

  it('acepta una referencia opcional con salida de reserva', () => {
    const form = { ...validForm(), isRequired: false, onErrorPolicy: 'FALLBACK' as const };
    expect(referenceErrors('RESULT_1', form)).toEqual([]);
  });

  it('rechaza una condición de ejecución que no es JSON', () => {
    const form = { ...validForm(), executionCondition: '{ esto no es json' };
    expect(referenceErrors('RESULT_1', form).join(' ')).toContain('JSON válido');
  });

  it('envía la política completa al backend', () => {
    const body = buildReferenceBody('RESULT_1', {
      ...validForm(),
      environmentCode: 'DEV',
      maxRetries: 2,
      retryDelayMs: 250,
      executionCondition: '{"op":"gt","left":{"var":"score"},"right":{"value":600}}',
      isRequired: false,
      onErrorPolicy: 'SKIP',
      tracePolicy: 'MASKED',
    });
    expect(body).toMatchObject({
      environmentCode: 'DEV',
      versionSelection: 'EXACT',
      maxRetries: 2,
      retryDelayMs: 250,
      isRequired: false,
      tracePolicy: 'MASKED',
      executionCondition: { op: 'gt', left: { var: 'score' }, right: { value: 600 } },
    });
  });

  it('omite el ambiente y la condición cuando se dejan en blanco', () => {
    const body = buildReferenceBody('RESULT_1', validForm());
    expect(body.environmentCode).toBeUndefined();
    expect(body.executionCondition).toBeUndefined();
  });
});
