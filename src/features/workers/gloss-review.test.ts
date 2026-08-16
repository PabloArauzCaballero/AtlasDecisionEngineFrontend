import { avisoDeRevision, inicioDelPlazo, plazoAgotado } from './gloss-review';

/**
 * Cuándo la pantalla deja de esperar una glosa.
 *
 * La regla que se fija aquí es la que decide si esto ayuda o estorba: **el reloj
 * arranca cuando la ejecución EMPIEZA, no cuando se encola.** Sin esa
 * distinción, un extracto de seiscientas glosas mandaría a revisión a las
 * últimas por el simple hecho de estar haciendo cola —que es rendimiento del
 * sistema, no ambigüedad de la glosa— y llenaría la bandeja de trabajo con
 * casos que nadie tiene que mirar. La bandeja dejaría de significar nada.
 */

const PRESUPUESTO = 20_000;

describe('el reloj sólo corre cuando la ejecución ya arrancó', () => {
  it('en cola no cronometra nada', () => {
    expect(inicioDelPlazo('QUEUED', 1_000, null)).toBeNull();
  });

  it('arranca en cuanto deja la cola', () => {
    expect(inicioDelPlazo('RUNNING', 1_000, null)).toBe(1_000);
  });

  it('una vez arrancado no se reinicia en cada sondeo', () => {
    // Reiniciarlo aquí sería la forma silenciosa de que el plazo no venciera
    // NUNCA: cada consulta lo devolvería a cero y la fila giraría para siempre.
    expect(inicioDelPlazo('RUNNING', 9_000, 1_000)).toBe(1_000);
  });

  it('una ejecución que ya corría no vuelve a cero si el motor la reporta en cola', () => {
    expect(inicioDelPlazo('QUEUED', 9_000, 1_000)).toBe(1_000);
  });
});

describe('el plazo', () => {
  it('no vence mientras la ejecución siga en cola', () => {
    // Aunque hayan pasado horas desde que se pidió.
    expect(plazoAgotado(null, 10_000_000, PRESUPUESTO)).toBe(false);
  });

  it('no vence antes de tiempo', () => {
    expect(plazoAgotado(1_000, 1_000 + PRESUPUESTO - 1, PRESUPUESTO)).toBe(false);
  });

  it('vence justo al cumplirse', () => {
    expect(plazoAgotado(1_000, 1_000 + PRESUPUESTO, PRESUPUESTO)).toBe(true);
  });
});

describe('el aviso', () => {
  it('concuerda en número y dice dónde queda el trabajo', () => {
    const uno = avisoDeRevision(1);
    expect(uno.title).toBe('1 glosa enviada a revisión');
    expect(avisoDeRevision(3).title).toBe('3 glosas enviadas a revisión');
    // Sin esto el aviso sólo dice que algo pasó, no qué hacer al respecto.
    expect(uno.description).toMatch(/Pendientes/);
    expect(uno.description).toMatch(/continuar/i);
  });

  it('no habla de fallo ni de error: no ha fallado nada', () => {
    const texto = `${avisoDeRevision(2).title} ${avisoDeRevision(2).description}`;
    expect(texto).not.toMatch(/error|fall[oó]|no se pudo/i);
  });
});
