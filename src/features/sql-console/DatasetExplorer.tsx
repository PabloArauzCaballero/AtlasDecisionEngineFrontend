'use client';

import { ChevronDown, ChevronRight, Database, Search, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CatalogDataset, CatalogTable } from './sql-console.types';

interface Props {
  datasets: CatalogDataset[];
  selected: { dataset: string; table: string } | null;
  onSelect: (dataset: string, table: CatalogTable) => void;
  onInsert: (reference: string) => void;
}

/**
 * El explorador: dataset → tabla, con búsqueda.
 *
 * Dos decisiones de comportamiento que parecen menores y no lo son:
 *
 *  · **Buscar ABRE los datasets que tienen coincidencias.** Un árbol que filtra pero deja
 *    los nodos cerrados enseña «0 resultados» sobre un resultado que sí está; es el fallo
 *    clásico de los árboles con búsqueda y se nota justo cuando más prisa hay.
 *  · **La búsqueda mira también los nombres de COLUMNA.** Quien busca «desenlace» no sabe
 *    todavía en qué tabla está —ése es el motivo por el que busca— y limitar la búsqueda a
 *    los nombres de tabla obligaría a abrirlas una por una.
 *
 * Seleccionar una tabla abre su ficha; el botón aparte inserta la referencia en el editor.
 * Son dos gestos distintos a propósito: en BigQuery pulsar una tabla nunca escribe en la
 * consulta, y que lo hiciera destrozaría lo que se está escribiendo.
 */
export function DatasetExplorer({ datasets, selected, onSelect, onInsert }: Props) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return datasets;
    return datasets
      .map((dataset) => ({
        ...dataset,
        tables: dataset.tables.filter(
          (table) =>
            table.name.includes(needle) ||
            table.description.toLowerCase().includes(needle) ||
            table.columns.some((column) => column.name.includes(needle)),
        ),
      }))
      .filter((dataset) => dataset.tables.length > 0 || dataset.name.includes(needle));
  }, [datasets, query]);

  const searching = query.trim().length > 0;

  const toggle = (name: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <aside className="sql-explorer" aria-label="Explorador de datos">
      <div className="sql-explorer__search">
        <Search size={14} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar tabla o columna"
          aria-label="Buscar tabla o columna"
        />
      </div>

      <div className="sql-explorer__tree">
        {filtered.length === 0 ? (
          <p className="sql-explorer__empty">Ninguna tabla coincide con «{query}».</p>
        ) : null}

        {filtered.map((dataset) => {
          // Buscando, todo abierto: ver lo que se encontró es el objetivo de haber buscado.
          const open = searching || !closed.has(dataset.name);
          return (
            <section key={dataset.name} className="sql-explorer__dataset">
              <button
                type="button"
                className="sql-explorer__dataset-head"
                onClick={() => toggle(dataset.name)}
                aria-expanded={open}
                title={dataset.description}
              >
                {open ? (
                  <ChevronDown size={14} aria-hidden />
                ) : (
                  <ChevronRight size={14} aria-hidden />
                )}
                <Database size={14} aria-hidden />
                <span className="sql-explorer__dataset-name">{dataset.name}</span>
                <span className="sql-explorer__count">{dataset.tables.length}</span>
              </button>

              {open ? (
                <ul className="sql-explorer__tables">
                  {dataset.tables.map((table) => {
                    const active =
                      selected?.dataset === dataset.name && selected.table === table.name;
                    return (
                      <li key={table.name}>
                        <button
                          type="button"
                          className={`sql-explorer__table${active ? ' is-active' : ''}`}
                          onClick={() => onSelect(dataset.name, table)}
                          aria-current={active ? 'true' : undefined}
                          title={table.description}
                        >
                          <Table2 size={13} aria-hidden />
                          <span>{table.name}</span>
                        </button>
                        <button
                          type="button"
                          className="sql-explorer__insert"
                          onClick={() => onInsert(`${dataset.name}.${table.name}`)}
                          aria-label={`Insertar ${dataset.name}.${table.name} en la consulta`}
                        >
                          +
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
