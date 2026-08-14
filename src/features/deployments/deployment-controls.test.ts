import { describe, expect, it } from 'vitest';
import { esAccionable, MAX_REASON_LENGTH, MIN_REASON_LENGTH } from './deployment-controls.api';

/**
 * Las dos reglas que deciden si el portal OFRECE revertir o suspender.
 *
 * El motor publicaba `rollback` y `suspend` desde hacía meses y ninguna vista las llamaba, así
 * que revertir producción sólo se podía hacer por fuera del portal — sin el registro que el
 * portal aporta, y en el momento en que más importa saber quién decidió qué.
 *
 * Al traerlas, lo que hay que fijar no es la llamada HTTP (eso lo prueba el e2e contra el motor
 * real) sino las dos decisiones de producto que la envuelven, porque las dos son fáciles de
 * aflojar sin darse cuenta.
 */
describe('sobre qué despliegues se puede intervenir', () => {
  it('sólo sobre los vivos', () => {
    expect(esAccionable('ACTIVE')).toBe(true);
    // PREPARING entra: un despliegue a medio publicar es justamente el que más urge parar.
    expect(esAccionable('PREPARING')).toBe(true);
  });

  it('no sobre los que ya terminaron su vida', () => {
    /*
     * Revertir algo ya revertido, suspendido o sustituido no es un error del usuario que
     * convenga dejar que descubra con un 409 del motor: es una acción sin sentido, y ofrecerla
     * sugiere que lo tiene. En un incidente, pulsar un control que no hace nada cuesta el
     * tiempo de averiguar por qué no hizo nada.
     */
    for (const estado of ['SUSPENDED', 'SUPERSEDED', 'ROLLED_BACK', 'FAILED']) {
      expect(esAccionable(estado)).toBe(false);
    }
  });

  it('un estado desconocido NO habilita la acción', () => {
    // Falla cerrado. Si el motor añade mañana un estado, el portal deja de ofrecer la acción
    // hasta que alguien decida si procede — al revés, la ofrecería sobre algo que no entiende.
    expect(esAccionable('ESTADO_QUE_NO_EXISTE')).toBe(false);
    expect(esAccionable(undefined)).toBe(false);
    expect(esAccionable(null)).toBe(false);
  });
});

describe('el motivo obligatorio', () => {
  it('exige lo suficiente para que informe a alguien', () => {
    // El motor sólo exige que `reason` exista. Un campo que acepta «x» cumple ese contrato y no
    // informa a nadie: diez caracteres no garantizan una buena explicación, pero impiden la
    // peor, que es la que se escribe para que el botón se encienda.
    expect(MIN_REASON_LENGTH).toBeGreaterThanOrEqual(10);
  });

  it('no supera el tope del motor', () => {
    // Si el portal admitiera más de lo que el motor acepta, el rechazo llegaría DESPUÉS de
    // escribir el motivo entero — en un incidente, perdiendo el texto y el tiempo.
    expect(MAX_REASON_LENGTH).toBe(8000);
  });
});
