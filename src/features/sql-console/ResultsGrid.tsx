'use client';

import type { QueryResult, ResultColumnKind, ResultValue } from './sql-console.types';

interface Props {
  result: QueryResult;
}

/** Las columnas numéricas y de fecha se alinean a la derecha; comparar dígitos exige columna. */
const NUMERIC: ReadonlySet<ResultColumnKind> = new Set(['numero', 'entero']);

function format(value: ResultValue, kind: ResultColumnKind): string {
  /*
   * `null` se pinta como «null» y no como celda vacía.
   *
   * Es la misma regla que sostienen las tres pantallas de medición del portal: una celda en
   * blanco se lee como cero o como espacio de más, y en un LEFT JOIN el `null` es
   * exactamente el hallazgo —la ejecución que no tiene desenlace, la ventana sin observar—.
   * Confundirlo con vacío convierte el resultado principal de la consulta en ruido visual.
   */
  if (value === null) return 'null';
  if (kind === 'fecha' && typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * La rejilla de resultados.
 *
 * Los enteros grandes y los decimales llegan como CADENA desde el motor —para no perder
 * precisión al pasar por JSON— y aquí se muestran tal cual, sin volver a convertirlos a
 * número. La alineación se decide por `column.kind`, que es lo que ese campo existe para
 * hacer: reconvertirlos «para formatear» reintroduciría en el navegador exactamente la
 * pérdida que el motor evitó en el servidor.
 *
 * Las filas se numeran, como en BigQuery. Con miles de filas sin numerar no hay forma de
 * decirle a alguien «mira la 4127», y esa frase es la mitad de una revisión.
 */
export function ResultsGrid({ result }: Props) {
  if (result.rowCount === 0) {
    return (
      <p className="sql-results__empty">
        La consulta se ejecutó correctamente y no devolvió ninguna fila.
      </p>
    );
  }

  return (
    <div className="sql-grid__scroll">
      <table className="sql-grid">
        <caption className="sr-only">Resultado de la consulta</caption>
        <thead>
          <tr>
            <th scope="col" className="sql-grid__index">
              #
            </th>
            {result.columns.map((column) => (
              <th
                key={column.name}
                scope="col"
                className={NUMERIC.has(column.kind) ? 'is-numeric' : undefined}
              >
                <span className="sql-grid__name">{column.name}</span>
                <span className="sql-grid__kind">{column.kind}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            // El índice como clave es correcto aquí: las filas de un resultado no se
            // reordenan ni se editan, se sustituyen enteras al volver a ejecutar.
            <tr key={rowIndex}>
              <th scope="row" className="sql-grid__index">
                {rowIndex + 1}
              </th>
              {row.map((value, columnIndex) => {
                const kind = result.columns[columnIndex]?.kind ?? 'texto';
                return (
                  <td
                    key={columnIndex}
                    className={[
                      NUMERIC.has(kind) ? 'is-numeric' : '',
                      value === null ? 'is-null' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {format(value, kind)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
