import { describe, expect, it } from 'vitest';
import { MOTIVOS, normalizarVerificacion, tonoVerificacion } from './audit-integrity.api';

/**
 * Dos defectos medidos el 2026-09-13 sobre el portal desplegado, los dos en la misma pantalla y
 * los dos silenciosos:
 *
 * 1. El motor emite `EVENT_HASH_MISMATCH` cuando un evento fue ALTERADO; el catálogo del portal
 *    sólo conocía `HASH_MISMATCH`. Sin coincidencia, `incidente` quedaba indefinido y la pantalla
 *    pintaba en ÁMBAR —«no se pudo comprobar»— lo que es una manipulación en rojo.
 * 2. `invalid` se consumía como si siempre llegara. Una respuesta sin esa clave rompía la vista
 *    entera con un TypeError, que es lo que el barrido de errores del portal venía viendo en
 *    `/audit-events`.
 */
describe('integridad del registro de auditoría', () => {
  describe('el motivo que emite el motor se reconoce', () => {
    it('EVENT_HASH_MISMATCH es un incidente, no una duda', () => {
      expect(MOTIVOS.EVENT_HASH_MISMATCH?.incidente).toBe(true);
    });

    it('el nombre anterior sigue reconociéndose, para informes ya archivados', () => {
      expect(MOTIVOS.HASH_MISMATCH?.incidente).toBe(true);
    });

    it('una cadena con un evento alterado se pinta en rojo', () => {
      const tono = tonoVerificacion({
        valid: false,
        eventCount: 120,
        headHash: 'abc',
        invalid: [{ id: '7', reason: 'EVENT_HASH_MISMATCH' }],
      });
      expect(tono).toBe('danger');
    });

    it('una clave retirada NO es rojo: es ámbar, porque no se pudo comprobar', () => {
      const tono = tonoVerificacion({
        valid: false,
        eventCount: 120,
        headHash: 'abc',
        invalid: [{ id: '7', reason: 'HASH_KEY_UNAVAILABLE' }],
      });
      expect(tono).toBe('warning');
    });

    it('un motivo desconocido tampoco se pinta como incidente', () => {
      const tono = tonoVerificacion({
        valid: false,
        eventCount: 3,
        headHash: null,
        invalid: [{ id: '1', reason: 'MOTIVO_QUE_NADIE_HA_ESCRITO_TODAVIA' }],
      });
      expect(tono).toBe('warning');
    });
  });

  describe('la respuesta se normaliza en el borde', () => {
    it('sin `invalid` no revienta, y la cadena NO se declara válida', () => {
      const dato = normalizarVerificacion({ valid: false, eventCount: 9, headHash: 'h' });
      expect(dato.invalid).toEqual([]);
      expect(dato.valid).toBe(false);
      expect(() => tonoVerificacion(dato)).not.toThrow();
      expect(tonoVerificacion(dato)).toBe('warning');
    });

    it('una respuesta vacía o ilegible se queda en cero eventos, no inventa un veredicto', () => {
      for (const bruto of [undefined, null, {}, 'no es un objeto']) {
        const dato = normalizarVerificacion(bruto);
        expect(dato).toEqual({ valid: false, eventCount: 0, headHash: null, invalid: [] });
        expect(tonoVerificacion(dato)).toBe('neutral');
      }
    });

    it('descarta los eslabones que no traen id y motivo, y conserva los que sí', () => {
      const dato = normalizarVerificacion({
        valid: false,
        eventCount: 2,
        headHash: null,
        invalid: [{ id: '1', reason: 'EVENT_HASH_MISMATCH' }, { id: '2' }, null, 'roto'],
      });
      expect(dato.invalid).toEqual([{ id: '1', reason: 'EVENT_HASH_MISMATCH' }]);
    });

    it('una cadena válida con eventos sigue siendo verde', () => {
      const dato = normalizarVerificacion({
        valid: true,
        eventCount: 1280,
        headHash: 'cafe',
        invalid: [],
      });
      expect(tonoVerificacion(dato)).toBe('success');
    });

    it('un headHash que no es texto no se pinta como eslabón', () => {
      expect(
        normalizarVerificacion({ valid: true, eventCount: 1, headHash: 42 }).headHash,
      ).toBeNull();
    });
  });
});
