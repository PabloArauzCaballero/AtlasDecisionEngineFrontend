'use client';

import { ChevronDown, ChevronRight, ChevronsUpDown, SortAsc, SortDesc } from 'lucide-react';
import { Fragment, useState } from 'react';
import { NavLink } from '../navigation/NavLink';
import { resolvePath } from '../utils/records';
import { ActionIcon } from './ActionIcon';
import { ACTIONS, type ActionKey } from './action-catalog';
import { DataTableToolbar, type TableDensity } from './DataTableToolbar';
import { InfoHint } from './InfoHint';
import { StatusBadge } from './StatusBadge';
import { formatCell } from './table-format';
import { nextSort, quickFilterRows, sortRows, type SortState } from './table-tools';

export interface TableColumn<T> {
  key: keyof T & string;
  label: string;
  mono?: boolean;
  status?: boolean;
  /** Con `status`, traduce valores crudos del backend a etiquetas legibles. */
  labels?: Record<string, string>;
  /**
   * Dot-notation path into the row for nested or renamed backend fields, e.g.
   * 'artifactVersion.artifact.artifactCode'. When set it overrides `key` as the
   * value source (`key` stays the stable React/column identifier).
   */
  path?: string;
  /** Plain-language explanation of the column, shown as a ? in the header. */
  hint?: string;
  /**
   * Sólo en la fila desplegada. Para valores largos —una expresión, una lista de
   * pasos— que ensanchan la tabla hasta empujar fuera de la vista la columna que
   * identifica la fila. Siguen siendo buscables y ordenables. Sin barra de
   * herramientas no hay despliegue, así que se muestran como una columna más.
   */
  detail?: boolean;
  /**
   * Deja que la celda ocupe varias líneas en vez de recortarse en una.
   *
   * Por defecto una celda es una línea con puntos suspensivos, que es lo que
   * mantiene las filas comparables. Para una columna de prosa —una explicación,
   * un nombre largo— eso obliga a reservar 320 px de ancho y a desplazar la
   * tabla; envolviendo cabe entera en la mitad.
   */
  wrap?: boolean;
}

/** Mismo icono que el botón de la fila: el catálogo es la única verdad. */
const DetailIcon = ACTIONS.view.icon;

export interface RowAction {
  action: ActionKey;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Texto accesible especializado (recomendado sobre el genérico del catálogo). */
  label?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: readonly TableColumn<T>[];
  getRowKey: (row: T) => string;
  detailPath?: (row: T) => string;
  /** Acciones por fila con iconos del catálogo. Tiene prioridad sobre detailPath. */
  rowActions?: (row: T) => RowAction[];
  /** Desactiva barra de herramientas, orden y filas expandibles (tablas breves). */
  tools?: boolean;
}

/**
 * Tabla de datos del portal.
 *
 * Sobre la tabla plana original añade lo que faltaba para trabajar de verdad con
 * ella: ordenar por cualquier columna, buscar dentro de lo ya cargado y desplegar
 * una fila para leer sus valores completos —las celdas se recortan con puntos
 * suspensivos, así que un identificador o un JSON largo era ilegible sin salir
 * de la vista—.
 *
 * Orden y búsqueda actúan sobre la página cargada y la barra lo dice: el filtrado
 * contra el backend sigue estando arriba, en la barra de filtros.
 */
export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  getRowKey,
  detailPath,
  rowActions,
  tools = true,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [query, setQuery] = useState('');
  const [density, setDensity] = useState<TableDensity>('comfortable');
  const [expanded, setExpanded] = useState<string | null>(null);

  const hasActions = Boolean(rowActions) || Boolean(detailPath);
  const sortable = columns.map((column) => ({ key: column.key, path: column.path }));
  const inRow = tools ? columns.filter((column) => !column.detail) : columns;
  const visible = tools ? sortRows(quickFilterRows(rows, query, sortable), sort, sortable) : rows;
  const sortedColumn = columns.find((column) => column.key === sort?.key);
  const span = inRow.length + (tools ? 1 : 0) + (hasActions ? 1 : 0);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <p>No hay registros para los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className={`data-table density-${density}${tools ? ' has-expander' : ''}`}>
      {tools ? (
        <DataTableToolbar
          query={query}
          onQueryChange={setQuery}
          density={density}
          onDensityChange={setDensity}
          shown={visible.length}
          total={rows.length}
          sortLabel={
            sortedColumn && sort
              ? `${sortedColumn.label} ${sort.direction === 'asc' ? '↑' : '↓'}`
              : undefined
          }
          onClearSort={() => setSort(null)}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {tools ? <th scope="col" className="table-expander-head" /> : null}
              {inRow.map((column, index) => (
                <TableHead
                  key={column.key}
                  column={column}
                  identity={index === 0}
                  sort={sort}
                  sortable={tools}
                  onSort={() => setSort((current) => nextSort(current, column.key))}
                />
              ))}
              {hasActions ? (
                <th scope="col" className="table-actions">
                  Acciones
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const key = getRowKey(row);
              const open = expanded === key;
              return (
                <Fragment key={key}>
                  <tr className={open ? 'is-expanded' : undefined}>
                    {tools ? (
                      <td className="table-expander">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={open ? 'Ocultar el detalle' : 'Ver el detalle completo'}
                          onClick={() => setExpanded(open ? null : key)}
                        >
                          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      </td>
                    ) : null}
                    {inRow.map((column, index) => {
                      const value = column.path ? resolvePath(row, column.path) : row[column.key];
                      const classes = [
                        column.mono ? 'mono' : '',
                        column.wrap ? 'table-wrap-cell' : '',
                        index === 0 ? 'table-identity' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <td key={column.key} className={classes || undefined}>
                          {column.status ? (
                            <StatusBadge value={value} labels={column.labels} />
                          ) : (
                            formatCell(value)
                          )}
                        </td>
                      );
                    })}
                    {hasActions ? (
                      <td className="table-actions">
                        <div className="action-row">
                          {rowActions ? (
                            rowActions(row).map((rowAction, index) => (
                              <ActionIcon key={`${rowAction.action}-${index}`} {...rowAction} />
                            ))
                          ) : detailPath ? (
                            <ActionIcon action="view" href={detailPath(row)} />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  {open ? (
                    <tr className="table-detail-row">
                      <td colSpan={span}>
                        <div className="table-detail row-expand">
                          <dl className="table-detail-grid">
                            {columns.map((column) => (
                              <div key={column.key}>
                                <dt>{column.label}</dt>
                                <dd>
                                  {formatCell(
                                    column.path ? resolvePath(row, column.path) : row[column.key],
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          {/*
                           * El icono de la última columna dice «Ver detalle» sólo
                           * al posarse encima, y en una tabla ancha vive fuera de
                           * la parte visible. Quien despliega una fila está justo
                           * buscando saber más de ELLA: aquí el mismo destino se
                           * ofrece con su nombre escrito.
                           */}
                          {detailPath ? (
                            <NavLink
                              className="button table-detail-open"
                              href={detailPath(row)}
                              showSpinner
                            >
                              <DetailIcon size={15} aria-hidden /> {ACTIONS.view.label}
                            </NavLink>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!visible.length ? (
              <tr>
                <td colSpan={span} className="table-no-match">
                  Ninguna fila de esta página coincide con «{query}». Otras páginas pueden
                  contenerla: usa los filtros de arriba para buscar en todo el catálogo.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TableHeadProps<T> {
  column: TableColumn<T>;
  /** Primera columna de la fila: es la que ancla el nombre del registro. */
  identity: boolean;
  sort: SortState | null;
  sortable: boolean;
  onSort: () => void;
}

function TableHead<T>({ column, identity, sort, sortable, onSort }: TableHeadProps<T>) {
  const active = sort?.key === column.key;
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? SortAsc : SortDesc;
  return (
    <th
      scope="col"
      className={identity ? 'table-identity' : undefined}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {sortable ? (
        <button
          type="button"
          className={active ? 'table-sort active' : 'table-sort'}
          title={`Ordenar por ${column.label}. Afecta a las filas de esta página.`}
          onClick={onSort}
        >
          {column.label}
          <Icon size={13} aria-hidden="true" />
        </button>
      ) : (
        column.label
      )}
      {column.hint ? <InfoHint text={column.hint} label={`Qué es: ${column.label}`} /> : null}
    </th>
  );
}
