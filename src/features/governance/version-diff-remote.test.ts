import { describe, expect, it } from 'vitest';
import { adaptarDiffDelMotor } from './version-diff-remote';

/**
 * El portal explica el veredicto del motor; no emite el suyo.
 *
 * Estas pruebas fijan justamente esa frontera. Lo que NO se prueba aquí es «qué cambió» —eso ya
 * no lo decide este código— sino que la explicación no pierda ni invente nada respecto a lo que
 * el motor entregó.
 */
const RESPUESTA = {
  left: { versionId: '54' },
  right: { versionId: '55' },
  nodes: {
    added: [{ key: 'REVISION', label: 'Revisión manual' }],
    removed: [{ key: 'VIEJO', label: 'Paso retirado' }],
    changed: [
      {
        before: { key: 'EVAL', label: 'Evalúa score', x: 10 },
        after: { key: 'EVAL', label: 'Evalúa buró', x: 40 },
      },
    ],
  },
  edges: { added: [], removed: [], changed: [] },
};

describe('adaptarDiffDelMotor', () => {
  it('desglosa un elemento cambiado CAMPO A CAMPO', () => {
    /*
     * Es la razón por la que no se borró el código del cliente al traer el diff del motor. El
     * motor dice «este nodo cambió»; el revisor necesita saber si se movió de sitio o si le
     * cambiaron el umbral. Sustituir lo segundo por lo primero habría cambiado un problema de
     * coherencia por uno de información.
     */
    const diff = adaptarDiffDelMotor(RESPUESTA);
    const label = diff.entries.find((entrada) => entrada.path === 'nodes.EVAL.label');
    expect(label).toBeDefined();
    expect(label?.before).toBe('Evalúa score');
    expect(label?.after).toBe('Evalúa buró');
  });

  it('marca como cosmético lo que sólo mueve el dibujo', () => {
    // Se informa igual —ocultar un cambio es mentir— pero separado, para que no se confunda
    // con lógica al firmar una aprobación.
    const diff = adaptarDiffDelMotor(RESPUESTA);
    const posicion = diff.entries.find((entrada) => entrada.path === 'nodes.EVAL.x');
    expect(posicion?.cosmetic).toBe(true);
    expect(diff.substantive.some((entrada) => entrada.path === 'nodes.EVAL.x')).toBe(false);
  });

  it('conserva añadidos y quitados con su identificador', () => {
    const diff = adaptarDiffDelMotor(RESPUESTA);
    expect(diff.entries.some((e) => e.kind === 'added' && e.entityId === 'REVISION')).toBe(true);
    expect(diff.entries.some((e) => e.kind === 'removed' && e.entityId === 'VIEJO')).toBe(true);
  });

  it('identifica un elemento cambiado aunque el identificador venga sólo en un lado', () => {
    // Un elemento renombrado sigue siendo el mismo elemento. Quedarse con `after` a secas
    // perdería el identificador de un cambio que borra ese campo.
    const diff = adaptarDiffDelMotor({
      nodes: { added: [], removed: [], changed: [{ before: { key: 'SOLO_ANTES' }, after: {} }] },
    });
    expect(diff.entries.every((entrada) => entrada.entityId === 'SOLO_ANTES')).toBe(true);
  });

  it('distingue «no hay nada que comparar» de «no hubo cambios»', () => {
    /*
     * Las dos pintan una lista vacía y significan cosas opuestas: la primera es que el motor no
     * devolvió colecciones —un fallo—, la segunda es que las versiones son iguales, que es una
     * respuesta buena. `empty` las separa.
     */
    expect(adaptarDiffDelMotor({}).empty).toBe(true);
    const sinCambios = adaptarDiffDelMotor({
      nodes: { added: [], removed: [], changed: [] },
    });
    expect(sinCambios.empty).toBe(false);
    expect(sinCambios.entries).toHaveLength(0);
  });

  it('no revienta con una respuesta que no tiene la forma esperada', () => {
    // El adaptador está en la frontera: un motor que responda otra cosa deja la pantalla sin
    // diff, no rota.
    expect(() => adaptarDiffDelMotor(null)).not.toThrow();
    expect(() => adaptarDiffDelMotor({ nodes: 'texto' })).not.toThrow();
    expect(adaptarDiffDelMotor({ nodes: { added: 'no es lista' } }).entries).toHaveLength(0);
  });
});
