import { describe, expect, it } from 'vitest';
import { resolveView, viewsFor, WORKER_VIEWS } from './worker-views';
import type { WorkerCode } from './workers.api';

/**
 * Qué se le ofrece a cada worker.
 *
 * No es una prueba de maquetación: es la decisión de producto de que Categorías
 * y Pendientes pertenecen al catálogo de categorías, y por tanto a los workers
 * que clasifican contra él. Ofrecerlas en los otros prometería una relación que
 * no existe; negárselas a quien sí clasifica —el de extractos manda cada glosa
 * al semántico— deja la corrección fuera de alcance justo donde se ve el fallo.
 */
const CLASIFICAN: readonly WorkerCode[] = ['semantic-analysis', 'bank-statement'];
const OTROS: readonly WorkerCode[] = ['identity-verification', 'audio-tts'];

function idsDe(worker: WorkerCode): string[] {
  return viewsFor(worker).map((view) => view.id);
}

describe('pestañas de cada worker', () => {
  it('el semántico tiene las del catálogo: clasifica contra él', () => {
    expect(idsDe('semantic-analysis')).toEqual(['panel', 'consola', 'categorias', 'pendientes']);
  });

  /*
   * El de extractos clasifica Y tiene franja de revisión, así que las tiene
   * todas. Se afirma aparte del semántico justamente para que quede escrito que
   * son dos decisiones distintas y no una lista que creció por inercia.
   */
  it('el de extractos tiene además su bandeja de revisión', () => {
    expect(idsDe('bank-statement')).toEqual([
      'panel',
      'consola',
      'categorias',
      'pendientes',
      'revision',
    ]);
  });

  it.each(OTROS)('%s no ofrece Categorías ni Pendientes', (worker) => {
    expect(idsDe(worker)).not.toEqual(expect.arrayContaining(['categorias', 'pendientes']));
  });

  /*
   * «Revisión» es de los DOS workers cuyo contrato tiene una franja que el motor
   * manda a una persona en vez de resolver a la fuerza: el parecido entre
   * umbrales en identidad, la clasificación del documento —más el timeout, la
   * baja confianza de extracción y el descuadre contable— en extractos.
   * Ofrecerla en los otros prometería una bandeja que nunca tendría nada dentro.
   */
  it('identity-verification ofrece su bandeja de Revisión', () => {
    expect(idsDe('identity-verification')).toEqual(['panel', 'consola', 'revision']);
  });

  it('la Revisión no se le ofrece a quien no tiene franja ambigua', () => {
    for (const worker of ['audio-tts', 'semantic-analysis'] as const) {
      expect(idsDe(worker)).not.toContain('revision');
    }
  });

  it('todos conservan las dos preguntas de un servicio asíncrono', () => {
    for (const worker of [...OTROS, ...CLASIFICAN]) {
      // «¿está bien?» y «procesa esto». Sin alguna de las dos, la vista deja de
      // servir para lo que existe.
      expect(idsDe(worker)).toEqual(expect.arrayContaining(['panel', 'consola']));
    }
  });

  /*
   * La regla se declara sobre `WORKER_VIEWS`, así que una pestaña nueva entra
   * por omisión en TODOS los workers. Esta prueba es el recordatorio: si alguien
   * añade una que dependa del catálogo, tiene que decidirlo explícitamente.
   */
  it('no hay pestañas huérfanas: toda vista se le ofrece a alguien', () => {
    const ofrecidas = new Set([...CLASIFICAN, ...OTROS].flatMap(idsDe));
    expect([...ofrecidas].sort()).toEqual(WORKER_VIEWS.map((view) => view.id).sort());
  });
});

describe('a qué pestaña se cae al cambiar de worker', () => {
  it('quien está en Pendientes y se va al de locución aterriza en el panel', () => {
    expect(resolveView('audio-tts', 'pendientes')).toBe('panel');
  });

  it('quien está en Categorías y se va al de identidad aterriza en el panel', () => {
    expect(resolveView('identity-verification', 'categorias')).toBe('panel');
  });

  it('quien está en Categorías y se va al de extractos SE QUEDA: ahí también clasifica', () => {
    expect(resolveView('bank-statement', 'categorias')).toBe('categorias');
    expect(resolveView('bank-statement', 'pendientes')).toBe('pendientes');
  });

  it('una pestaña que ese worker sí tiene se conserva', () => {
    expect(resolveView('audio-tts', 'consola')).toBe('consola');
    expect(resolveView('semantic-analysis', 'pendientes')).toBe('pendientes');
    expect(resolveView('identity-verification', 'revision')).toBe('revision');
  });

  it('quien está en Revisión y se va al semántico aterriza en el panel', () => {
    expect(resolveView('semantic-analysis', 'revision')).toBe('panel');
  });

  it('quien está en Revisión y se va al de extractos SE QUEDA: ahí también hay cola', () => {
    expect(resolveView('bank-statement', 'revision')).toBe('revision');
  });

  it('una pestaña inventada —de una URL vieja o escrita a mano— no rompe la vista', () => {
    expect(resolveView('semantic-analysis', 'inexistente')).toBe('panel');
  });
});
