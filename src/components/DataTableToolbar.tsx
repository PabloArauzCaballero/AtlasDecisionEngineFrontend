'use client';

import { Rows2, Rows3, Search, X } from 'lucide-react';
import { Tooltip } from './Tooltip';

export type TableDensity = 'comfortable' | 'compact';

interface DataTableToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  /** Filas visibles tras la búsqueda rápida y filas cargadas en la página. */
  shown: number;
  total: number;
  /** Estado de orden activo, para poder retirarlo desde aquí. */
  sortLabel?: string;
  onClearSort?: () => void;
}

/**
 * Barra de herramientas de una tabla: búsqueda rápida, densidad y estado.
 *
 * La búsqueda actúa sobre las filas ya cargadas y lo dice explícitamente, para
 * que nadie confunda "no aparece en esta página" con "no existe en el sistema".
 * El filtro del backend sigue estando arriba, en la barra de filtros.
 */
export function DataTableToolbar({
  query,
  onQueryChange,
  density,
  onDensityChange,
  shown,
  total,
  sortLabel,
  onClearSort,
}: DataTableToolbarProps) {
  const compact = density === 'compact';
  return (
    <div className="table-toolbar">
      <div className="table-quick-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={query}
          aria-label="Buscar en las filas cargadas"
          placeholder="Buscar en esta página…"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query ? (
          <button type="button" aria-label="Limpiar la búsqueda" onClick={() => onQueryChange('')}>
            <X size={14} />
          </button>
        ) : null}
      </div>

      <p className="table-toolbar-count" aria-live="polite">
        {query ? (
          <>
            <strong>{shown}</strong> de {total} filas de esta página
          </>
        ) : (
          <>
            <strong>{total}</strong> filas en esta página
          </>
        )}
      </p>

      {sortLabel && onClearSort ? (
        <button type="button" className="table-sort-chip" onClick={onClearSort}>
          Orden: {sortLabel} <X size={12} aria-hidden="true" />
        </button>
      ) : null}

      <Tooltip
        content={compact ? 'Volver a filas cómodas' : 'Compactar filas para ver más de una vez'}
      >
        <button
          type="button"
          className="icon-button"
          aria-pressed={compact}
          aria-label={compact ? 'Densidad compacta activa' : 'Activar densidad compacta'}
          onClick={() => onDensityChange(compact ? 'comfortable' : 'compact')}
        >
          {compact ? <Rows3 size={17} /> : <Rows2 size={17} />}
        </button>
      </Tooltip>
    </div>
  );
}
