import { fireEvent, render, screen } from '@testing-library/react';
import { CategoryTree } from './CategoryTree';
import { StatementCategoriesChart } from './StatementCategoriesChart';
import { MAX_BARRAS, resumirCategorias } from './statement-category-summary';
import { claveMovimiento, type VeredictoCategoria } from './useStatementCategories';
import type { SemanticCategory } from './categories.api';

/**
 * El reparto por categorías: qué cuenta, qué no, y qué se dice cuando no cabe.
 *
 * Lo que se mide aquí no es el dibujo, es lo que el dibujo AFIRMA. Un gráfico
 * que asciende un veredicto dudoso a categoría, o que corta la lista sin
 * decirlo, se lee como un hecho y no lo es.
 */

function movimiento(descripcion: string, movementType: string, amount: number) {
  return { description: descripcion, movementType, amount };
}

function veredicto(categoria: string, ruta: string[], estado = 'MATCH'): VeredictoCategoria {
  return { fase: 'listo', estado, categoria, ruta, confianza: 0.9 };
}

describe('reparto de movimientos por categoría', () => {
  it('cuenta MOVIMIENTOS, no glosas: la repetida pesa lo que se repite', () => {
    const veredictos = {
      [claveMovimiento({ descripcion: 'COMISION', movementType: 'DEBIT' })]: veredicto(
        'GASTOS.BANCO',
        ['Gastos', 'Comisiones'],
      ),
    };
    const resumen = resumirCategorias(
      {
        transactions: [
          movimiento('COMISION', 'DEBIT', -10),
          movimiento('COMISION', 'DEBIT', -10),
          movimiento('COMISION', 'DEBIT', -10),
        ],
      },
      veredictos,
    );

    expect(resumen.gastos.filas).toHaveLength(1);
    expect(resumen.gastos.filas[0]?.movimientos).toBe(3);
    expect(resumen.gastos.filas[0]?.importe).toBe(30);
    expect(resumen.ingresos.filas).toHaveLength(0);
    expect(resumen.clasificados).toBe(3);
  });

  /*
   * El mismo texto como cargo y como abono son dos preguntas distintas, y el
   * hook las guarda con claves distintas. Si el reparto buscara sólo por la
   * glosa, el abono heredaría la categoría del cargo.
   */
  it('separa el mismo texto según su sentido', () => {
    const veredictos = {
      [claveMovimiento({ descripcion: 'TRASPASO', movementType: 'DEBIT' })]: veredicto(
        'GASTOS.TRASPASO',
        ['Gastos', 'Traspaso enviado'],
      ),
      [claveMovimiento({ descripcion: 'TRASPASO', movementType: 'CREDIT' })]: veredicto(
        'INGRESOS.TRASPASO',
        ['Ingresos', 'Traspaso recibido'],
      ),
    };
    const resumen = resumirCategorias(
      {
        transactions: [movimiento('TRASPASO', 'DEBIT', -100), movimiento('TRASPASO', 'CREDIT', 50)],
      },
      veredictos,
    );

    // Y cada uno cae en SU lado: el sentido lo decide el banco, no la categoría.
    expect(resumen.gastos.filas.map((fila) => fila.etiqueta)).toEqual(['Traspaso enviado']);
    expect(resumen.ingresos.filas.map((fila) => fila.etiqueta)).toEqual(['Traspaso recibido']);
  });

  /*
   * Un veredicto `AMBIGUOUS` no asciende a categoría: la tabla de arriba tampoco
   * lo asciende, y un gráfico que contradiga a la tabla que tiene encima es peor
   * que no estar.
   */
  it('no asciende un veredicto dudoso: cuenta como sin determinar', () => {
    const veredictos = {
      [claveMovimiento({ descripcion: 'PAGO', movementType: 'DEBIT' })]: veredicto(
        'GASTOS.VARIOS',
        ['Gastos', 'Varios'],
        'AMBIGUOUS',
      ),
    };
    const resumen = resumirCategorias(
      { transactions: [movimiento('PAGO', 'DEBIT', -5)] },
      veredictos,
    );

    expect(resumen.clasificados).toBe(0);
    expect(resumen.gastos.filas.at(-1)?.etiqueta).toBe('Sin determinar');
    expect(resumen.gastos.filas.at(-1)?.codigo).toBeNull();
  });

  it('«Sin determinar» va al final aunque sea la mayor', () => {
    const veredictos = {
      [claveMovimiento({ descripcion: 'LUZ', movementType: 'DEBIT' })]: veredicto('GASTOS.LUZ', [
        'Gastos',
        'Energía',
      ]),
    };
    const resumen = resumirCategorias(
      {
        transactions: [
          movimiento('LUZ', 'DEBIT', -10),
          ...Array.from({ length: 9 }, (_, i) => movimiento(`OTRO ${i}`, 'DEBIT', -1)),
        ],
      },
      veredictos,
    );

    expect(resumen.gastos.filas.at(-1)?.etiqueta).toBe('Sin determinar');
    expect(resumen.gastos.filas.at(-1)?.movimientos).toBe(9);
    expect(resumen.gastos.filas[0]?.etiqueta).toBe('Energía');
  });

  /*
   * Un tope callado se lee como «esto es todo». Con más categorías de las que
   * caben, la barra sobrante se nombra y dice cuántas agrupa.
   */
  it('agrupa el sobrante y dice cuántas categorías agrupa', () => {
    const cuantas = MAX_BARRAS + 3;
    const veredictos: Record<string, VeredictoCategoria> = {};
    const transactions = Array.from({ length: cuantas }, (_, index) => {
      const descripcion = `GLOSA ${index}`;
      veredictos[claveMovimiento({ descripcion, movementType: 'DEBIT' })] = veredicto(
        `GASTOS.C${index}`,
        ['Gastos', `Categoría ${index}`],
      );
      // Decrecientes: las tres últimas son las que no caben.
      return Array.from({ length: cuantas - index }, () => movimiento(descripcion, 'DEBIT', -1));
    }).flat();

    const resumen = resumirCategorias({ transactions }, veredictos);

    expect(resumen.categorias).toBe(cuantas);
    expect(resumen.gastos.filas).toHaveLength(MAX_BARRAS + 1);
    expect(resumen.gastos.filas.at(-1)?.etiqueta).toBe('Otras 3 categorías');
    expect(resumen.gastos.filas.at(-1)?.agrupa).toBe(3);
  });

  it('sin movimientos no dibuja nada', () => {
    const { container } = render(
      <StatementCategoriesChart resumen={resumirCategorias({ transactions: [] }, {})} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  /*
   * El gasto principal es el que se lleva más DINERO, no el que más se repite.
   * Ordenar por número de movimientos ponía doce cafés por delante de un
   * alquiler, que es justo la lectura contraria a la que se busca.
   */
  it('ordena cada lado por importe, no por número de movimientos', () => {
    const veredictos = {
      [claveMovimiento({ descripcion: 'CAFE', movementType: 'DEBIT' })]: veredicto('GASTOS.CAFE', [
        'Gastos',
        'Cafetería',
      ]),
      [claveMovimiento({ descripcion: 'ALQUILER', movementType: 'DEBIT' })]: veredicto(
        'GASTOS.ALQUILER',
        ['Gastos', 'Alquiler'],
      ),
    };
    const resumen = resumirCategorias(
      {
        transactions: [
          ...Array.from({ length: 12 }, () => movimiento('CAFE', 'DEBIT', -20)),
          movimiento('ALQUILER', 'DEBIT', -3000),
        ],
      },
      veredictos,
    );

    expect(resumen.gastos.filas.map((fila) => fila.etiqueta)).toEqual(['Alquiler', 'Cafetería']);
    expect(resumen.gastos.importe).toBe(3240);
  });

  it('cada barra lleva escrito su rótulo, su importe y su parte', () => {
    const veredictos = {
      [claveMovimiento({ descripcion: 'SUPER', movementType: 'DEBIT' })]: veredicto(
        'GASTOS.SUPER',
        ['Gastos', 'Alimentación', 'Supermercado'],
      ),
      [claveMovimiento({ descripcion: 'SUELDO', movementType: 'CREDIT' })]: veredicto(
        'INGRESOS.SUELDO',
        ['Ingresos', 'Sueldo'],
      ),
    };
    render(
      <StatementCategoriesChart
        resumen={resumirCategorias(
          {
            transactions: [
              movimiento('SUELDO', 'CREDIT', 1000),
              movimiento('SUPER', 'DEBIT', -30),
              movimiento('SUPER', 'DEBIT', -30),
              movimiento('OTRA', 'DEBIT', -40),
            ],
          },
          veredictos,
        )}
      />,
    );

    // Los dos lados existen y están rotulados: la separación no depende del color.
    expect(screen.getByRole('heading', { name: 'Ingresos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gastos' })).toBeInTheDocument();
    // Sin mirar el color: el dato está escrito, barra por barra.
    expect(screen.getByText('Supermercado')).toBeInTheDocument();
    expect(screen.getByText('Gastos › Alimentación')).toBeInTheDocument();
    expect(screen.getByText('Sin determinar')).toBeInTheDocument();
    expect(screen.getByText('60 % · 2')).toBeInTheDocument();
    expect(screen.getByText('40 % · 1')).toBeInTheDocument();
  });
});

/**
 * La jerarquía del árbol se dibuja con el NIVEL de cada nodo, y la guía de una
 * rama la pinta el `<ul>` de sus hijas. Declarado en la fila —donde estaba— el
 * `<ul>` no podía leerlo y todas las guías caían en la misma abscisa: a partir
 * del segundo nivel la línea señalaba a otra rama.
 */
describe('jerarquía del árbol de categorías', () => {
  const categoria = (code: string, parentCode: string | null): SemanticCategory => ({
    code,
    name: code,
    parentCode,
    description: '',
    positiveExamples: [],
    counterExamples: [],
    restrictions: [],
    relatedCategoryCodes: [],
    acceptanceThreshold: 0.7,
    version: 1,
    isActive: true,
  });

  it('declara el nivel en el nodo, que es lo que la guía puede leer', () => {
    const { container } = render(
      <CategoryTree
        categorias={[
          categoria('GASTOS', null),
          categoria('GASTOS.VIVIENDA', 'GASTOS'),
          categoria('GASTOS.VIVIENDA.LUZ', 'GASTOS.VIVIENDA'),
        ]}
        onEditar={() => {}}
        onDesactivar={() => {}}
        onAgregarHija={() => {}}
      />,
    );

    // El árbol arranca con las raíces abiertas y el resto cerrado, así que el
    // tercer nivel hay que pedirlo: es el mismo gesto que hace quien lo mira.
    fireEvent.click(screen.getByRole('button', { expanded: false, name: /GASTOS.VIVIENDA/ }));

    const niveles = [...container.querySelectorAll('.categoria-nodo')].map((nodo) =>
      (nodo as HTMLElement).style.getPropertyValue('--nivel'),
    );
    expect(niveles).toEqual(['0', '1', '2']);
    // Y la fila ya no lo declara: si lo hiciera, volvería a ganar el valor de la
    // hija sobre el de la rama y la guía se desplazaría un nivel.
    const fila = container.querySelector('.categoria-fila') as HTMLElement;
    expect(fila.style.getPropertyValue('--nivel')).toBe('');
  });

  it('distingue rama de hoja en el marcado, no sólo con un icono', () => {
    const { container } = render(
      <CategoryTree
        categorias={[categoria('GASTOS', null), categoria('GASTOS.LUZ', 'GASTOS')]}
        onEditar={() => {}}
        onDesactivar={() => {}}
        onAgregarHija={() => {}}
      />,
    );

    expect(container.querySelectorAll('.categoria-nodo.es-rama')).toHaveLength(1);
    expect(container.querySelectorAll('.categoria-nodo.es-hoja')).toHaveLength(1);
  });
});
