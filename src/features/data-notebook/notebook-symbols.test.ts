import { describe, expect, it } from 'vitest';
import { simbolosDeFuente, simbolosDisponibles } from './notebook-symbols';
import type { NotebookCell } from './notebook-types';

/**
 * La memoria de variables del editor.
 *
 * Lo que se comprueba aquí no es que la expresión regular case: es la REGLA de alcance. Un
 * autocompletado que ofrece un nombre inexistente no es una ayuda incompleta, es una trampa —se
 * acepta la sugerencia y la celda revienta señalando a quien la escribió—, así que las pruebas que
 * importan son las que fijan qué NO se ofrece.
 */

function celda(source: string, language: NotebookCell['language'] = 'python'): NotebookCell {
  return {
    id: `c-${source.length}-${language}`,
    kind: 'code',
    language,
    source,
    outcome: null,
    running: false,
    executionCount: null,
  };
}

const nombres = (simbolos: readonly { nombre: string }[]) => simbolos.map((s) => s.nombre);

describe('lectura de una fuente', () => {
  it('reconoce lo que Python define de las formas habituales', () => {
    const encontrados = nombres(
      simbolosDeFuente(
        [
          'import numpy as np',
          'from pandas import DataFrame, Series',
          'ventas = df.groupby("mes").sum()',
          'total: int = 0',
          'def resumir(x):',
          '    return x',
          'class Informe:',
          '    pass',
          'for fila in rows:',
          '    pass',
          'with open("f") as archivo:',
          '    pass',
        ].join('\n'),
        'python',
      ),
    );

    expect(encontrados).toEqual(
      expect.arrayContaining([
        'np',
        'DataFrame',
        'Series',
        'ventas',
        'total',
        'resumir',
        'Informe',
        'fila',
        'archivo',
      ]),
    );
  });

  it('no confunde una comparación con una asignación', () => {
    // `==` no define nada. Sin la comprobación de que el siguiente carácter no es `=`, el editor
    // ofrecía `estado` como variable en una celda donde sólo se comparaba.
    expect(nombres(simbolosDeFuente('if estado == "ok":\n    pass', 'python'))).not.toContain(
      'estado',
    );
  });

  it('deja fuera lo interno del cuaderno', () => {
    // Los ayudantes del preámbulo existen de verdad en el intérprete, pero ofrecerlos sería
    // invitar a usar una interioridad que puede cambiar sin aviso.
    expect(nombres(simbolosDeFuente('__atlas_figuras = 1', 'python'))).toHaveLength(0);
  });

  it('reconoce lo que R define, empezando por la flecha', () => {
    const encontrados = simbolosDeFuente(
      [
        'library(stats)',
        'ventas <- aggregate(importe ~ mes, df, sum)',
        'umbral = 0.3',
        'global.total <<- 0',
        'resumir <- function(x) mean(x)',
        'for (fila in seq_len(n)) print(fila)',
      ].join('\n'),
      'r',
    );

    expect(nombres(encontrados)).toEqual(
      expect.arrayContaining(['stats', 'ventas', 'umbral', 'global.total', 'resumir', 'fila']),
    );
    // Una función es una función, no una variable: es lo que decide el icono de la sugerencia.
    expect(encontrados.find((s) => s.nombre === 'resumir')?.origen).toBe('funcion');
  });

  it('en R no confunde una comparación ni una flecha de asignación con otra cosa', () => {
    expect(nombres(simbolosDeFuente('if (estado == "ok") print(1)', 'r'))).not.toContain('estado');
    // `<-` frente a `<--`: el segundo es «menor que menos uno», no una asignación.
    expect(nombres(simbolosDeFuente('x <-- 1', 'r'))).not.toContain('x');
  });

  it('deja fuera los ayudantes que el cuaderno instala en R', () => {
    expect(nombres(simbolosDeFuente('.atlas_normaliza <- function(x) x', 'r'))).toHaveLength(0);
  });

  it('reconoce lo que JavaScript declara', () => {
    const encontrados = nombres(
      simbolosDeFuente('const activos = rows.filter(Boolean);\nfunction contar() {}', 'javascript'),
    );
    expect(encontrados).toEqual(expect.arrayContaining(['activos', 'contar']));
  });
});

describe('qué puede nombrar una celda', () => {
  const previas = [celda('ventas = df.sum()'), celda('const activos = 1;', 'javascript')];

  it('en Python hereda lo definido en las celdas anteriores', () => {
    const encontrados = nombres(
      simbolosDisponibles({
        language: 'python',
        propia: '',
        previas,
        columnas: [],
        runtime: [],
      }),
    );
    expect(encontrados).toContain('ventas');
  });

  /**
   * La regla que no se puede copiar de otro cuaderno: cada celda de JavaScript corre en un worker
   * NUEVO, así que las variables de otra celda no existen cuando ésta se ejecuta. Ofrecerlas
   * produciría un `ReferenceError` sugerido por la propia herramienta.
   */
  it('en JavaScript NO hereda nada de otras celdas', () => {
    const encontrados = nombres(
      simbolosDisponibles({
        language: 'javascript',
        propia: 'const propio = 1;',
        // La consola ya no las pasa; que aquí se ignoren aunque lleguen es la segunda barrera.
        previas,
        columnas: [],
        runtime: [],
      }),
    );
    expect(encontrados).toContain('propio');
    expect(encontrados).not.toContain('activos');
    expect(encontrados).not.toContain('ventas');
  });

  /**
   * R hereda como Python y NO como JavaScript: su entorno global sobrevive entre celdas. Y hereda
   * sólo de las celdas de R — una variable de Python no existe dentro del intérprete de R, que es
   * otro proceso de WebAssembly con su propia memoria.
   */
  it('en R hereda de las celdas de R y de ninguna otra', () => {
    const encontrados = nombres(
      simbolosDisponibles({
        language: 'r',
        propia: '',
        previas: [celda('recientes <- head(df)', 'r'), ...previas],
        columnas: [],
        runtime: [],
      }),
    );
    expect(encontrados).toContain('recientes');
    expect(encontrados).not.toContain('ventas');
    expect(encontrados).not.toContain('activos');
  });

  it('en R la API del cuaderno es df, columns y n; no rows', () => {
    const encontrados = nombres(
      simbolosDisponibles({ language: 'r', propia: '', previas: [], columnas: [], runtime: [] }),
    );
    expect(encontrados).toEqual(expect.arrayContaining(['df', 'columns', 'n']));
    // `rows` es una lista de diccionarios, que en R no significa nada: ofrecerlo sugeriría un
    // objeto que el preámbulo no crea.
    expect(encontrados).not.toContain('rows');
  });

  it('ofrece la API del cuaderno y las columnas del dataset', () => {
    const encontrados = nombres(
      simbolosDisponibles({
        language: 'python',
        propia: '',
        previas: [],
        columnas: ['estado_credito'],
        runtime: [],
      }),
    );
    expect(encontrados).toEqual(
      expect.arrayContaining(['rows', 'columns', 'df', 'estado_credito']),
    );
  });

  it('el tipo medido en el intérprete gana al deducido leyendo el código', () => {
    // Leyendo `ventas = ...` sólo se sabe que es una variable; el intérprete sabe que es un
    // DataFrame, y eso es justo lo que hace útil la sugerencia.
    const [ventas] = simbolosDisponibles({
      language: 'python',
      propia: '',
      previas: [celda('ventas = df.sum()')],
      columnas: [],
      runtime: [{ nombre: 'ventas', detalle: 'DataFrame', origen: 'variable' }],
    }).filter((simbolo) => simbolo.nombre === 'ventas');

    expect(ventas?.detalle).toBe('DataFrame');
  });
});
