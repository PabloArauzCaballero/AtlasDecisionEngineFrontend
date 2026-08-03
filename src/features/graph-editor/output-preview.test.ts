import { describe, expect, it } from 'vitest';
import { buildPreviewShape } from './OutputContractJsonPreview';

/**
 * La vista previa es lo que promete el artefacto a quien lo llama, así que debe
 * describir el contrato declarado —no inventar campos ni omitir los motivos
 * estructurados que acompañan a una salida.
 */
describe('buildPreviewShape', () => {
  const outputs = [
    { code: 'decision', dataType: 'STRING', required: true },
    { code: 'motivo', dataType: 'STRING', required: false },
  ];

  it('describe cada salida con su tipo y sensibilidad declarada', () => {
    const shape = buildPreviewShape(outputs, [
      { code: 'decision', sensitivityClass: 'CONFIDENTIAL' },
    ]);
    expect(shape).toEqual({
      decision: { tipo: 'STRING', obligatorio: true, sensibilidad: 'CONFIDENTIAL' },
      // Sin fila en el contrato se asume la sensibilidad por defecto del panel.
      motivo: { tipo: 'STRING', obligatorio: false, sensibilidad: 'INTERNAL' },
    });
  });

  it('incluye los reason codes sólo cuando el campo declara alguno', () => {
    const shape = buildPreviewShape(outputs, [
      { code: 'decision', reasonCodes: ['DTI_TOO_HIGH'] },
      { code: 'motivo', reasonCodes: [] },
    ]);
    expect(shape.decision).toMatchObject({ reasonCodes: ['DTI_TOO_HIGH'] });
    expect(shape.motivo).not.toHaveProperty('reasonCodes');
  });
});
