'use client';

import { X } from 'lucide-react';
import type { CatalogTable } from './sql-console.types';

interface Props {
  dataset: string;
  table: CatalogTable;
  onClose: () => void;
  onInsertColumn: (column: string) => void;
  onQueryTable: (reference: string) => void;
}

/**
 * La ficha de una tabla: qué es una fila y qué columnas tiene.
 *
 * Es el equivalente de la pestaña «Esquema» de BigQuery, con una diferencia deliberada:
 * aquí el GRANO va arriba del todo y en grande, antes que las columnas. En BigQuery el
 * grano no se publica y hay que deducirlo del nombre, que es la razón por la que tanta
 * consulta cuenta filas de una tabla de detalle creyendo que cuenta entidades. Publicar la
 * frase «una fila = una decisión ejecutada» es más barato que corregir ese error una vez.
 *
 * No hay pestaña de «Vista previa». En BigQuery la hay porque enseña las primeras filas de
 * la tabla sin coste; aquí toda fila es una decisión sobre una persona, y ofrecer un
 * vistazo gratis a datos reales sin que nadie escriba una consulta —sin intención, sin
 * filtro y sin quedar en la bitácora como una pregunta concreta— es justo lo que una
 * superficie gobernada no debe tener.
 */
export function TableSchemaPanel({ dataset, table, onClose, onInsertColumn, onQueryTable }: Props) {
  const reference = `${dataset}.${table.name}`;
  return (
    <section className="sql-schema" aria-label={`Esquema de ${reference}`}>
      <header className="sql-schema__head">
        <div>
          <p className="sql-schema__eyebrow">{dataset}</p>
          <h3 className="sql-schema__title">{table.name}</h3>
        </div>
        <button
          type="button"
          className="sql-schema__close"
          onClick={onClose}
          aria-label="Cerrar el esquema"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      {/*
       * Sin grano declarado se DICE, no se deja el hueco en blanco.
       *
       * Desde que el catálogo se descubre de la base puede haber tablas por delante de su
       * documentación. Un párrafo vacío se lee como que la tabla no necesitaba explicación; el
       * aviso dice lo único que importa aquí, que es que nadie ha comprobado qué es una fila.
       */}
      <p className={table.grain ? 'sql-schema__grain' : 'sql-schema__grain sql-schema__grain--sin'}>
        {table.grain ?? 'Grano sin declarar: comprueba qué es una fila antes de contar.'}
      </p>
      <p className="sql-schema__description">{table.description}</p>

      <button type="button" className="sql-schema__query" onClick={() => onQueryTable(reference)}>
        Consultar esta tabla
      </button>

      <table className="sql-schema__columns">
        <caption className="sr-only">Columnas de {reference}</caption>
        <thead>
          <tr>
            <th scope="col">Columna</th>
            <th scope="col">Tipo</th>
            <th scope="col">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((column) => (
            <tr key={column.name}>
              <th scope="row">
                <button
                  type="button"
                  className="sql-schema__column"
                  onClick={() => onInsertColumn(column.name)}
                  aria-label={`Insertar la columna ${column.name} en la consulta`}
                >
                  {column.name}
                </button>
              </th>
              <td>
                <span className={`sql-kind sql-kind--${column.kind}`}>{column.kind}</span>
              </td>
              <td>{column.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
