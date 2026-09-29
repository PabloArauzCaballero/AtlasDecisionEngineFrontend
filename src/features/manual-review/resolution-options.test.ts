import { describe, expect, it } from 'vitest';
import {
  CASE_STATUS_LABEL,
  CLOSED_CASE_STATUSES,
  RESOLUTION_LABEL,
  RESOLUTION_OPTIONS,
  RESOLUTION_OUTCOME_TEXT,
} from './resolution-options';

/**
 * Lo que acepta el motor en `POST /v1/manual-reviews/:id/resolve`
 * (`ResolveManualReviewDto`: `@IsIn(['APPROVE', 'DECLINE', 'CANCEL'])`). Con cualquier otro valor
 * contesta 400. Copiado a mano a propósito: si el motor cambia el contrato, esta lista es lo que
 * hay que cambiar a la vez que la pantalla.
 */
const ACEPTADOS_POR_EL_MOTOR = ['APPROVE', 'DECLINE', 'CANCEL'];
/** El estado que el motor deja en el caso (`ManualReviewStatus`). */
const ESTADOS_DEL_MOTOR = [
  'OPEN',
  'ASSIGNED',
  'RESOLVED_APPROVED',
  'RESOLVED_DECLINED',
  'CANCELLED',
];

describe('opciones de resolución de una revisión manual', () => {
  it('ninguna opción de la pantalla da 400 en el motor', () => {
    for (const opcion of RESOLUTION_OPTIONS) {
      expect(ACEPTADOS_POR_EL_MOTOR, `«${opcion.label}» manda ${opcion.value}`).toContain(
        opcion.value,
      );
    }
  });

  it('ofrece exactamente Aprobar, Rechazar y Cancelar caso, cada uno con su valor del contrato', () => {
    expect(RESOLUTION_OPTIONS.map((opcion) => [opcion.value, opcion.label])).toEqual([
      ['APPROVE', 'Aprobar'],
      ['DECLINE', 'Rechazar'],
      ['CANCEL', 'Cancelar caso'],
    ]);
  });

  it('no promete «Escalar»: el motor no tiene un nivel superior de revisión', () => {
    const texto = JSON.stringify(RESOLUTION_OPTIONS).toLowerCase();
    expect(texto).not.toContain('escal');
    expect(texto).not.toContain('nivel superior');
  });

  it('«Cancelar caso» dice que no decide y que la solicitud queda como estaba', () => {
    const cancelar = RESOLUTION_OPTIONS.find((opcion) => opcion.value === 'CANCEL');
    expect(cancelar?.description).toMatch(/sin decidir/);
    expect(cancelar?.description).toMatch(/queda como estaba/);
    expect(RESOLUTION_OUTCOME_TEXT.CANCEL).toMatch(/sin decidir/);
  });

  it('cada valor ofrecido tiene rótulo y frase de confirmación', () => {
    for (const opcion of RESOLUTION_OPTIONS) {
      expect(RESOLUTION_LABEL[opcion.value as keyof typeof RESOLUTION_LABEL]).toBeTruthy();
      expect(
        RESOLUTION_OUTCOME_TEXT[opcion.value as keyof typeof RESOLUTION_OUTCOME_TEXT],
      ).toBeTruthy();
    }
  });

  it('traduce todos los estados que el motor deja en el caso y marca cuáles están cerrados', () => {
    for (const estado of ESTADOS_DEL_MOTOR) expect(CASE_STATUS_LABEL[estado]).toBeTruthy();
    expect([...CLOSED_CASE_STATUSES].sort()).toEqual(
      ['CANCELLED', 'RESOLVED_APPROVED', 'RESOLVED_DECLINED'].sort(),
    );
  });
});
