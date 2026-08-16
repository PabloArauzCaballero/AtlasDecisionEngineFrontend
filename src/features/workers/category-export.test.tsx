import { fireEvent, render, screen } from '@testing-library/react';
import { leerJson } from './category-csv';
import { aplanarExportacion, categoriasAArbolExportado, categoriasAJson } from './category-json';
import { CategoryTree } from './CategoryTree';
import { CategoryTreeToolbar } from './CategoryTreeToolbar';
import { armarArbol, codigosDeRama, useRamasCerradas } from './category-tree.model';
import type { SemanticCategory } from './categories.api';

/**
 * La descarga del árbol de categorías.
 *
 * Lo que se mide aquí no es que el archivo se genere, es que AFIRME la verdad:
 * que lleva el catálogo entero —y no lo que estuviera desplegado en pantalla—,
 * que la jerarquía sobrevive dentro del archivo, y que lo descargado se puede
 * volver a subir. Un archivo al que le faltan ramas no lo dice en ninguna parte:
 * se abre, tiene buena pinta, y alguien lo archiva como si fuera el catálogo.
 */

function categoria(
  code: string,
  parentCode: string | null,
  extra: Partial<SemanticCategory> = {},
): SemanticCategory {
  return {
    code,
    // El nombre NO puede repetir el código: la fila pinta los dos, y con el
    // mismo texto una consulta por texto encontraría dos nodos y no sabría cuál.
    name: `Nombre de ${code}`,
    description: '',
    parentCode,
    positiveExamples: [],
    counterExamples: [],
    restrictions: [],
    relatedCategoryCodes: [],
    acceptanceThreshold: 0.7,
    version: 1,
    isActive: true,
    ...extra,
  };
}

/** Dos niveles bajo GASTOS y una raíz hermana: la forma mínima con jerarquía real. */
const CATALOGO: SemanticCategory[] = [
  categoria('GASTOS', null),
  categoria('GASTOS.VIVIENDA', 'GASTOS'),
  categoria('GASTOS.VIVIENDA.LUZ', 'GASTOS.VIVIENDA', {
    acceptanceThreshold: 0.62,
    positiveExamples: ['PAGO LUZ'],
    counterExamples: ['PAGO AGUA'],
  }),
  categoria('INGRESOS', null),
];

describe('exportación del árbol a JSON', () => {
  it('anida las hijas dentro de su rama en vez de dejarlas en una lista plana', () => {
    const { categories } = categoriasAArbolExportado(CATALOGO);

    expect(categories.map((raiz) => raiz.code)).toEqual(['GASTOS', 'INGRESOS']);
    const gastos = categories[0];
    expect(gastos.children.map((hija) => hija.code)).toEqual(['GASTOS.VIVIENDA']);
    expect(gastos.children[0].children.map((nieta) => nieta.code)).toEqual(['GASTOS.VIVIENDA.LUZ']);
  });

  it('lleva el catálogo COMPLETO, no lo que estuviera expandido en pantalla', () => {
    // El plegado no toca la exportación: se le pasa el catálogo, no la vista.
    const { total, categories } = categoriasAArbolExportado(CATALOGO);
    const contar = (nodos: readonly { children: unknown[] }[]): number =>
      nodos.reduce(
        (suma, nodo) => suma + 1 + contar(nodo.children as { children: unknown[] }[]),
        0,
      );

    expect(total).toBe(CATALOGO.length);
    expect(contar(categories)).toBe(CATALOGO.length);
  });

  it('conserva los campos que deciden la clasificación', () => {
    const luz = categoriasAArbolExportado(CATALOGO).categories[0].children[0].children[0];

    expect(luz.acceptanceThreshold).toBe(0.62);
    expect(luz.positiveExamples).toEqual(['PAGO LUZ']);
    expect(luz.counterExamples).toEqual(['PAGO AGUA']);
  });

  it('no pierde una categoría cuyo padre no está en el catálogo: la sube a la raíz', () => {
    // Una referencia rota se tiene que PODER VER para arreglarla. Si la
    // exportación la descartara, el archivo tendría menos filas que la API y
    // nada lo diría.
    const roto = [...CATALOGO, categoria('GASTOS.HUERFANA', 'NO.EXISTE')];
    const { categories, total } = categoriasAArbolExportado(roto);

    expect(total).toBe(roto.length);
    expect(categories.map((raiz) => raiz.code)).toContain('GASTOS.HUERFANA');
  });

  it('sella el momento de la descarga', () => {
    const momento = new Date('2026-08-16T10:30:00.000Z');
    expect(categoriasAArbolExportado(CATALOGO, momento).exportedAt).toBe(
      '2026-08-16T10:30:00.000Z',
    );
  });
});

describe('lo descargado se puede volver a subir', () => {
  it('el importador lee el documento anidado y reconstruye el mismo catálogo', () => {
    const { categorias, problemas } = leerJson(categoriasAJson(CATALOGO));

    expect(problemas).toEqual([]);
    expect(categorias.map((c) => [c.code, c.parentCode])).toEqual([
      ['GASTOS', null],
      ['GASTOS.VIVIENDA', 'GASTOS'],
      ['GASTOS.VIVIENDA.LUZ', 'GASTOS.VIVIENDA'],
      ['INGRESOS', null],
    ]);
  });

  it('sigue leyendo el array plano de siempre', () => {
    const { categorias, problemas } = leerJson(
      JSON.stringify([{ code: 'GASTOS.LUZ', name: 'Luz', parentCode: 'GASTOS' }]),
    );

    expect(problemas).toEqual([]);
    expect(categorias[0].parentCode).toBe('GASTOS');
  });

  it('en un documento anidado manda la POSICIÓN, no un parentCode viejo', () => {
    // Quien mueve un nodo de rama en el archivo lo hace cortándolo y pegándolo.
    // Hacer caso al `parentCode` que arrastra lo devolvería a su sitio anterior.
    const filas = aplanarExportacion({
      categories: [
        { code: 'INGRESOS', children: [{ code: 'INGRESOS.LUZ', parentCode: 'GASTOS' }] },
      ],
    });

    expect(filas).toEqual([
      { code: 'INGRESOS', parentCode: null },
      { code: 'INGRESOS.LUZ', parentCode: 'INGRESOS' },
    ]);
  });

  it('deja pasar un nodo que no es un objeto para que el lector lo señale', () => {
    const { problemas } = leerJson(JSON.stringify({ categories: ['GASTOS'] }));

    expect(problemas).toHaveLength(1);
    // El «dónde» es lo que manda a alguien a la fila correcta del archivo.
    expect(problemas[0].donde).toBe('categoría 1');
  });

  it('un objeto que no es un documento anidado sigue dando «no es un array»', () => {
    const { problemas } = leerJson(JSON.stringify({ cualquier: 'cosa' }));

    expect(problemas).toHaveLength(1);
    expect(problemas[0].mensaje).toMatch(/array/i);
  });
});

describe('plegado en bloque', () => {
  it('codigosDeRama alcanza las ramas de CUALQUIER profundidad', () => {
    // Cerrar sólo el primer nivel deja las hijas abiertas por dentro y el botón
    // parece no haber hecho nada.
    expect(codigosDeRama(armarArbol(CATALOGO))).toEqual(['GASTOS', 'GASTOS.VIVIENDA']);
  });

  function Consola() {
    const control = useRamasCerradas(armarArbol(CATALOGO));
    return (
      <>
        <CategoryTreeToolbar categorias={CATALOGO} control={control} onNueva={() => {}} />
        <CategoryTree
          categorias={CATALOGO}
          control={control}
          onEditar={() => {}}
          onDesactivar={() => {}}
          onAgregarHija={() => {}}
        />
      </>
    );
  }

  it('«Expandir todo» abre también los niveles profundos', () => {
    render(<Consola />);
    // De arranque, GASTOS.VIVIENDA está cerrada y su hija no se ve.
    expect(screen.queryByText('GASTOS.VIVIENDA.LUZ')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Expandir todo/ }));

    expect(screen.getByText('GASTOS.VIVIENDA.LUZ')).toBeTruthy();
  });

  it('«Colapsar todo» cierra hasta las raíces', () => {
    render(<Consola />);
    fireEvent.click(screen.getByRole('button', { name: /Expandir todo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Colapsar todo/ }));

    expect(screen.queryByText('GASTOS.VIVIENDA')).toBeNull();
    // Las raíces siguen listadas: colapsar esconde el contenido, no el catálogo.
    expect(screen.getByText('GASTOS')).toBeTruthy();
  });
});
