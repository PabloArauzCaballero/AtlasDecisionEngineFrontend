'use client';

import { Search, X } from 'lucide-react';
import {
  TUTORIAL_CATEGORY_LABELS,
  TUTORIAL_LEVEL_LABELS,
  type TutorialCategory,
  type TutorialLevel,
} from './interactive-types';
import { EMPTY_FILTERS, STATE_LABELS, type CenterFilters } from './tutorial-center-state';

interface Props {
  filters: CenterFilters;
  onChange: (filters: CenterFilters) => void;
  /** Cuántos quedan tras filtrar, para poder decirlo en voz alta. */
  resultCount: number;
}

const CATEGORIES = Object.keys(TUTORIAL_CATEGORY_LABELS) as TutorialCategory[];
const LEVELS = Object.keys(TUTORIAL_LEVEL_LABELS) as TutorialLevel[];
const STATES = Object.keys(STATE_LABELS) as Array<keyof typeof STATE_LABELS>;

/** Buscador y filtros del Centro. Todos los controles llevan etiqueta visible. */
export function TutorialCenterFilters({ filters, onChange, resultCount }: Props) {
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="tutorial-center-filters" data-tutorial-id="tutorial-center-filters">
      <label className="tutorial-center-search" data-tutorial-id="tutorial-center-search">
        <Search size={15} aria-hidden />
        <span className="sr-only">Buscar un tutorial</span>
        <input
          type="search"
          value={filters.search}
          placeholder="Buscar por título o descripción…"
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </label>

      <label>
        <span>Módulo</span>
        <select
          value={filters.category}
          onChange={(event) =>
            onChange({ ...filters, category: event.target.value as CenterFilters['category'] })
          }
        >
          <option value="all">Todos</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {TUTORIAL_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Estado</span>
        <select
          value={filters.state}
          onChange={(event) =>
            onChange({ ...filters, state: event.target.value as CenterFilters['state'] })
          }
        >
          <option value="all">Todos</option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {STATE_LABELS[state]}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Nivel</span>
        <select
          value={filters.level}
          onChange={(event) =>
            onChange({ ...filters, level: event.target.value as CenterFilters['level'] })
          }
        >
          <option value="all">Todos</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {TUTORIAL_LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </label>

      {dirty ? (
        <button className="button" type="button" onClick={() => onChange(EMPTY_FILTERS)}>
          <X size={14} aria-hidden /> Limpiar
        </button>
      ) : null}

      {/* El recuento se anuncia: quien no ve la lista tiene que enterarse de que
          el filtro dejó resultados, o de que no dejó ninguno. */}
      <p className="tutorial-center-count" role="status">
        {resultCount} {resultCount === 1 ? 'tutorial' : 'tutoriales'}
      </p>
    </div>
  );
}
