import { Filter, X } from 'lucide-react';
import type { ResourceFilter } from './resource.types';

interface ActiveFilterChipsProps {
  /** Texto del filtro principal ya aplicado. */
  filter: string;
  filterLabel: string;
  extraFilters: Record<string, string>;
  filters: readonly ResourceFilter[];
  onRemove: (param: string | null) => void;
  onClearAll: () => void;
}

/**
 * Filtros activos, uno por uno y con su etiqueta.
 *
 * Antes sólo existía un botón de "Limpiar" que los borraba todos: para ver qué
 * estaba aplicado había que desplegar "Más filtros" y repasar los campos, y para
 * quitar uno solo no había forma. Cada chip nombra el filtro y su valor, y se
 * retira por separado.
 */
export function ActiveFilterChips({
  filter,
  filterLabel,
  extraFilters,
  filters,
  onRemove,
  onClearAll,
}: ActiveFilterChipsProps) {
  const active = Object.entries(extraFilters).filter(([, value]) => value.trim() !== '');
  const hasMain = filter.trim() !== '';
  if (!hasMain && !active.length) return null;

  const labelOf = (param: string) => filters.find((entry) => entry.param === param)?.label ?? param;

  return (
    <div className="active-filters" aria-label="Filtros aplicados">
      <span className="active-filters-title">
        <Filter size={13} aria-hidden="true" /> Filtros aplicados
      </span>
      {hasMain ? (
        <button type="button" className="filter-chip" onClick={() => onRemove(null)}>
          <b>{filterLabel}:</b> {filter}
          <X size={12} aria-hidden="true" />
          <span className="sr-only">Quitar este filtro</span>
        </button>
      ) : null}
      {active.map(([param, value]) => (
        <button key={param} type="button" className="filter-chip" onClick={() => onRemove(param)}>
          <b>{labelOf(param)}:</b> {value}
          <X size={12} aria-hidden="true" />
          <span className="sr-only">Quitar este filtro</span>
        </button>
      ))}
      <button type="button" className="filter-chip filter-chip-clear" onClick={onClearAll}>
        Quitar todos
      </button>
    </div>
  );
}
