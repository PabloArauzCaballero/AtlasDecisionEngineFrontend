import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type TableColumn } from './DataTable';
import { compareCells, nextSort, quickFilterRows, sortRows } from './table-tools';

interface Row extends Record<string, unknown> {
  id: string;
  code: string;
  total: string;
  createdAt: string;
  nested: { owner: string };
}

const ROWS: Row[] = [
  {
    id: '1',
    code: 'BETA',
    total: '20',
    createdAt: '2026-07-20T10:00:00Z',
    nested: { owner: 'riesgo' },
  },
  {
    id: '2',
    code: 'alfa',
    total: '100',
    createdAt: '2026-01-05T10:00:00Z',
    nested: { owner: 'fraude' },
  },
  {
    id: '3',
    code: 'Ómega',
    total: '3',
    createdAt: '2026-12-01T10:00:00Z',
    nested: { owner: 'riesgo' },
  },
];

const COLUMNS: TableColumn<Row>[] = [
  { key: 'code', label: 'Código' },
  { key: 'total', label: 'Total' },
  { key: 'createdAt', label: 'Creado' },
  { key: 'nested', label: 'Responsable', path: 'nested.owner' },
];

const renderTable = () =>
  render(<DataTable rows={ROWS} columns={COLUMNS} getRowKey={(row) => row.id} />);

const bodyCodes = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent ?? '');

describe('comparación de celdas', () => {
  it('ordena números como números, no como texto', () => {
    expect(compareCells('100', '20')).toBeGreaterThan(0);
  });

  it('ordena fechas cronológicamente', () => {
    expect(compareCells('2026-01-05T10:00:00Z', '2026-07-20T10:00:00Z')).toBeLessThan(0);
  });

  it('ordena texto con las reglas del español, ignorando mayúsculas y acentos', () => {
    expect(compareCells('alfa', 'BETA')).toBeLessThan(0);
    expect(compareCells('Ómega', 'zeta')).toBeLessThan(0);
  });

  it('manda los huecos al final en cualquier sentido', () => {
    expect(compareCells('—', 'alfa')).toBeGreaterThan(0);
    expect(compareCells('', 'alfa')).toBeGreaterThan(0);
  });
});

describe('estado de orden', () => {
  it('recorre ascendente, descendente y sin orden', () => {
    const first = nextSort(null, 'code');
    expect(first).toEqual({ key: 'code', direction: 'asc' });
    expect(nextSort(first, 'code')).toEqual({ key: 'code', direction: 'desc' });
    expect(nextSort({ key: 'code', direction: 'desc' }, 'code')).toBeNull();
  });

  it('empieza de nuevo al cambiar de columna', () => {
    expect(nextSort({ key: 'code', direction: 'desc' }, 'total')).toEqual({
      key: 'total',
      direction: 'asc',
    });
  });

  it('ordena por una columna con ruta anidada', () => {
    const sorted = sortRows(ROWS, { key: 'nested', direction: 'asc' }, [
      { key: 'nested', path: 'nested.owner' },
    ]);

    expect(sorted.map((row) => row.nested.owner)).toEqual(['fraude', 'riesgo', 'riesgo']);
  });
});

describe('búsqueda rápida', () => {
  it('exige que todas las palabras aparezcan, aunque estén en columnas distintas', () => {
    const columns = [{ key: 'code' }, { key: 'nested', path: 'nested.owner' }];

    expect(quickFilterRows(ROWS, 'beta riesgo', columns)).toHaveLength(1);
    expect(quickFilterRows(ROWS, 'beta fraude', columns)).toHaveLength(0);
  });

  it('devuelve todo cuando no se busca nada', () => {
    expect(quickFilterRows(ROWS, '   ', [{ key: 'code' }])).toHaveLength(3);
  });
});

describe('DataTable', () => {
  it('ordena al pulsar la cabecera y anuncia el sentido', () => {
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /Código/ }));

    expect(bodyCodes()).toEqual(['alfa', 'BETA', 'Ómega']);
    expect(screen.getByRole('columnheader', { name: /Código/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('invierte el orden en la segunda pulsación', () => {
    renderTable();
    const header = screen.getByRole('button', { name: /Código/ });

    fireEvent.click(header);
    fireEvent.click(header);

    expect(bodyCodes()).toEqual(['Ómega', 'BETA', 'alfa']);
  });

  it('filtra las filas cargadas y explica que el resto de páginas puede tener más', () => {
    renderTable();

    fireEvent.change(screen.getByLabelText('Buscar en las filas cargadas'), {
      target: { value: 'fraude' },
    });

    expect(bodyCodes()).toEqual(['alfa']);
    fireEvent.change(screen.getByLabelText('Buscar en las filas cargadas'), {
      target: { value: 'no-existe' },
    });
    expect(screen.getByText(/Otras páginas pueden contenerla/)).toBeInTheDocument();
  });

  it('despliega una fila con todos sus valores completos', () => {
    const { container } = renderTable();
    expect(container.querySelector('.table-detail')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver el detalle completo' })[0]);

    const detail = container.querySelector('.table-detail') as HTMLElement;
    // El detalle repite TODAS las columnas, incluidas las que la celda recorta.
    expect(within(detail).getByText('Responsable')).toBeInTheDocument();
    expect(within(detail).getByText('riesgo')).toBeInTheDocument();
    expect(within(detail).getAllByRole('term')).toHaveLength(COLUMNS.length);
  });

  it('reserva las columnas marcadas como detalle para la fila desplegada', () => {
    const columns: TableColumn<Row>[] = [
      { key: 'code', label: 'Código' },
      { key: 'nested', label: 'Responsable', path: 'nested.owner', detail: true },
    ];
    const { container } = render(
      <DataTable rows={ROWS} columns={columns} getRowKey={(row) => row.id} />,
    );

    // Fuera de la fila: ni cabecera ni celda, así no ensancha la tabla.
    expect(screen.queryByRole('columnheader', { name: /Responsable/ })).toBeNull();
    expect(screen.getAllByRole('row')[1].querySelectorAll('td')).toHaveLength(2);

    // Sigue siendo buscable, y al desplegar aparece con su valor.
    fireEvent.change(screen.getByLabelText('Buscar en las filas cargadas'), {
      target: { value: 'fraude' },
    });
    expect(screen.getAllByRole('row')).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver el detalle completo' })[0]);
    const detail = container.querySelector('.table-detail') as HTMLElement;
    expect(within(detail).getByText('Responsable')).toBeInTheDocument();
    expect(within(detail).getByText('fraude')).toBeInTheDocument();
  });

  it('permite compactar la densidad de las filas', () => {
    const { container } = renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Activar densidad compacta' }));

    expect(container.querySelector('.data-table')).toHaveClass('density-compact');
  });

  it('mantiene el estado vacío cuando no hay ninguna fila', () => {
    render(<DataTable rows={[]} columns={COLUMNS} getRowKey={(row) => row.id} />);

    expect(screen.getByText(/No hay registros/)).toBeInTheDocument();
  });
});
