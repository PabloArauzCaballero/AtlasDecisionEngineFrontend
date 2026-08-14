'use client';

import { ChevronLeft, ChevronRight, Download, FileJson } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { NotebookColumn } from './notebook.api';
import { cellText, downloadFile, fileName, toCsv, toJson } from './notebook-export';
import type { DerivedTable } from './notebook-types';

interface ResultTableProps {
  table: DerivedTable;
  /** Nombre base del archivo al descargar. */
  name: string;
  /** Políticas por columna, cuando la tabla viene del backend y no de una celda. */
  policies?: NotebookColumn[];
  /** Paginación del servidor. Sin esto, la tabla pagina sola en el cliente. */
  server?: {
    page: number;
    pageSize: number;
    total: number;
    totalIsExact: boolean;
    onPage: (page: number) => void;
    loading: boolean;
  };
}

const TAMANOS_CLIENTE = [25, 50, 100] as const;

/**
 * Una tabla, y las tres cosas que se hacen con ella: mirarla, paginarla y llevársela.
 *
 * Sirve tanto a la vista previa del dataset —donde el servidor manda la página— como a la salida
 * de una celda, que ya está entera en memoria. Se distinguen por `server`: cuando existe, los
 * botones piden otra página al backend; cuando no, se rebana el array local. Tener un solo
 * componente para ambos casos evita el desliz habitual de que la descarga del resultado de una
 * celda se lleve sólo las filas visibles.
 */
export function ResultTable({ table, name, policies, server }: ResultTableProps) {
  const [pageSize, setPageSize] = useState<number>(TAMANOS_CLIENTE[1]);
  const [clientPage, setClientPage] = useState(1);

  const totalClient = table.rows.length;
  const paginasCliente = Math.max(1, Math.ceil(totalClient / pageSize));
  const paginaSegura = Math.min(clientPage, paginasCliente);

  const visibles = useMemo(() => {
    if (server) return table.rows;
    const desde = (paginaSegura - 1) * pageSize;
    return table.rows.slice(desde, desde + pageSize);
  }, [server, table.rows, paginaSegura, pageSize]);

  const politicaDe = (columna: string) => policies?.find((politica) => politica.name === columna);

  const totalPaginas = server
    ? Math.max(1, Math.ceil(server.total / server.pageSize))
    : paginasCliente;
  const paginaActual = server ? server.page : paginaSegura;
  const irA = (pagina: number) => (server ? server.onPage(pagina) : setClientPage(pagina));

  return (
    <div className="notebook-result">
      <div className="notebook-result__toolbar">
        <p className="notebook-result__count">
          {server ? (
            <>
              {server.totalIsExact ? '' : 'más de '}
              <strong>{server.total.toLocaleString('es-BO')}</strong> filas
            </>
          ) : (
            <>
              <strong>{totalClient.toLocaleString('es-BO')}</strong> filas · {table.columns.length}{' '}
              columnas
            </>
          )}
        </p>
        <div className="notebook-result__actions">
          <button
            type="button"
            className="button"
            onClick={() => downloadFile(fileName(name, 'csv'), toCsv(table), 'csv')}
          >
            <Download aria-hidden="true" size={14} /> CSV
          </button>
          <button
            type="button"
            className="button"
            onClick={() => downloadFile(fileName(name, 'json'), toJson(table), 'json')}
          >
            <FileJson aria-hidden="true" size={14} /> JSON
          </button>
        </div>
      </div>

      <div className="notebook-result__scroll">
        <table className="notebook-table">
          <thead>
            <tr>
              <th scope="col" className="notebook-table__index">
                #
              </th>
              {table.columns.map((columna) => {
                const politica = politicaDe(columna);
                return (
                  <th key={columna} scope="col">
                    <span className="notebook-table__name">{columna}</span>
                    {politica && politica.policy !== 'PLAIN' ? (
                      <span
                        className={`notebook-table__policy notebook-table__policy--${politica.policy.toLowerCase()}`}
                        title={politica.reason ?? undefined}
                      >
                        {politica.policy === 'REDACTED' ? 'no se sirve' : 'enmascarado'}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td className="notebook-table__empty" colSpan={table.columns.length + 1}>
                  Sin filas.
                </td>
              </tr>
            ) : (
              visibles.map((fila, indice) => (
                // La clave es la posición porque una fila de datos no trae identidad: dos filas
                // pueden ser idénticas y seguir siendo dos. La lista se reemplaza entera al
                // cambiar de página, así que no hay reordenamiento que pudiera confundir a React.
                <tr key={indice}>
                  <td className="notebook-table__index">
                    {server
                      ? (server.page - 1) * server.pageSize + indice + 1
                      : (paginaSegura - 1) * pageSize + indice + 1}
                  </td>
                  {table.columns.map((columna) => (
                    <td key={columna}>{cellText(fila[columna])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="notebook-result__pager">
        <button
          type="button"
          className="button"
          onClick={() => irA(paginaActual - 1)}
          disabled={paginaActual <= 1 || Boolean(server?.loading)}
        >
          <ChevronLeft aria-hidden="true" size={14} /> Anterior
        </button>
        <span className="notebook-result__page">
          Página {paginaActual} de {totalPaginas}
        </span>
        <button
          type="button"
          className="button"
          onClick={() => irA(paginaActual + 1)}
          disabled={paginaActual >= totalPaginas || Boolean(server?.loading)}
        >
          Siguiente <ChevronRight aria-hidden="true" size={14} />
        </button>
        {server ? null : (
          <label className="notebook-result__size">
            Filas por página
            <select
              value={pageSize}
              onChange={(evento) => {
                setPageSize(Number(evento.target.value));
                setClientPage(1);
              }}
            >
              {TAMANOS_CLIENTE.map((tamano) => (
                <option key={tamano} value={tamano}>
                  {tamano}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
