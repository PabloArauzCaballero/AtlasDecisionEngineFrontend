import { describe, expect, it } from 'vitest';
import { emptyDraft } from './calculated-field.types';
import {
  draftBlocker,
  outcomesCall,
  sampleCall,
  testCall,
  tryCall,
  type TryTarget,
} from './calculated-field-preview';

/**
 * El mismo panel sirve a los dos destinos, así que lo único que puede fallar sin que se
 * note es a dónde manda cada botón: un ensayo de borrador que apuntara a la ruta de una
 * versión daría 404, y uno de versión que mandara la definición entera ensayaría el
 * borrador de la pantalla en vez de lo que hay guardado.
 */
const VERSION: TryTarget = { kind: 'VERSION', versionId: '6101' };

function draftTarget(): TryTarget {
  const draft = emptyDraft();
  draft.inputs = [
    { id: 'deuda', name: 'Deuda', description: '', dataType: 'DECIMAL', required: true },
  ];
  draft.operation = { operation: 'ABS', args: [{ input: 'deuda' }] };
  return { kind: 'DRAFT', draft };
}

describe('a dónde va cada ensayo', () => {
  it('una versión guardada usa sus propias rutas y no manda definición', () => {
    expect(tryCall(VERSION, { deuda: 1 })).toEqual({
      path: '/v1/calculated-fields/versions/6101/try',
      body: { inputs: { deuda: 1 } },
    });
    expect(testCall(VERSION).path).toBe('/v1/calculated-fields/versions/6101/test');
    expect(outcomesCall(VERSION, { count: 2 }).path).toBe(
      '/v1/calculated-fields/versions/6101/outcomes',
    );
    expect(sampleCall(VERSION, { kind: 'BOUNDARY', count: 5 }).body).not.toHaveProperty(
      'definition',
    );
  });

  it('un borrador viaja entero al camino de ensayo, que no persiste nada', () => {
    const target = draftTarget();
    const call = tryCall(target, { deuda: 3 });
    expect(call.path).toBe('/v1/calculated-fields/preview/try');
    expect(call.body).toMatchObject({
      inputs: { deuda: 3 },
      definition: { implementationKind: 'OPERATION' },
    });
    expect(outcomesCall(target, { count: 2, seed: 'x' }).body).toMatchObject({
      count: 2,
      seed: 'x',
      definition: expect.anything(),
    });
  });

  it('la semilla vacía no viaja: significa «dame una nueva», no «usa la cadena vacía»', () => {
    expect(sampleCall(VERSION, { kind: 'VALID', count: 1, seed: '' }).body.seed).toBeUndefined();
    expect(sampleCall(VERSION, { kind: 'VALID', count: 1, seed: 'abc' }).body.seed).toBe('abc');
  });

  it('un identificador de versión con caracteres raros se codifica', () => {
    expect(testCall({ kind: 'VERSION', versionId: 'a/b' }).path).toBe(
      '/v1/calculated-fields/versions/a%2Fb/test',
    );
  });
});

describe('qué falta para poder probar un borrador', () => {
  it('pide entradas antes que nada', () => {
    expect(draftBlocker(emptyDraft())).toMatch(/al menos una entrada/);
  });

  it('pide la operación en la modalidad visual y el código en las otras dos', () => {
    const withInput = emptyDraft();
    withInput.inputs = [
      { id: 'x', name: 'X', description: '', dataType: 'DECIMAL', required: true },
    ];
    expect(draftBlocker(withInput)).toMatch(/operación principal/);

    const code = { ...withInput, implementationKind: 'JAVASCRIPT' as const, sourceCode: '  ' };
    expect(draftBlocker(code)).toMatch(/Escribe el código/);
  });

  it('no estorba cuando el borrador ya se puede ejecutar', () => {
    const target = draftTarget();
    expect(draftBlocker((target as { draft: ReturnType<typeof emptyDraft> }).draft)).toBeNull();
  });
});
