'use client';

import { Search, X } from 'lucide-react';
import {
  TUTORIAL_CATEGORY_LABELS,
  TUTORIAL_LEVEL_LABELS,
  type TutorialCategory,
  type TutorialLevel,
} from './interactive-types';
import { EMPTY_FILTERS, STATE_LABELS, type CenterFilters } from './tutorial-center-state';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';

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
      <label
        /* sin-ayuda: buscador con icono; el texto oculto lo nombra */ className="tutorial-center-search"
        data-tutorial-id="tutorial-center-search"
      >
        <Search size={15} aria-hidden />
        <span className="sr-only">Buscar un tutorial</span>
        <input
          type="search"
          value={filters.search}
          placeholder="Buscar por título o descripción…"
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </label>

      <Field label={'Módulo'} tooltip="Filtra los tutoriales por el área del portal que enseñan.">
        <OptionSelect
          name="category"
          value={filters.category}
          onChange={(valor) =>
            onChange({ ...filters, category: valor as CenterFilters['category'] })
          }
          options={[
            {
              value: 'all',
              label: 'Todos',
              description: 'Sin filtrar: tutoriales de todos los módulos.',
            },
            ...CATEGORIES.map((item) => ({
              value: item, // sin-ayuda: el rótulo ya nombra el valor del filtro
              label: TUTORIAL_CATEGORY_LABELS[item],
            })),
          ]}
        />
      </Field>

      <Field label={'Estado'} tooltip="Filtra los tutoriales por tu avance en cada uno.">
        <OptionSelect
          name="state"
          value={filters.state}
          onChange={(valor) => onChange({ ...filters, state: valor as CenterFilters['state'] })}
          options={[
            {
              value: 'all',
              label: 'Todos',
              description: 'Sin filtrar: tutoriales en cualquier estado de avance.',
            },
            ...STATES.map((item) => ({
              value: item, // sin-ayuda: el rótulo ya nombra el valor del filtro
              label: STATE_LABELS[item],
            })),
          ]}
        />
      </Field>

      <Field label={'Nivel'} tooltip="Filtra por cuánto hay que saber ya para seguir el tutorial.">
        <OptionSelect
          name="level"
          value={filters.level}
          onChange={(valor) => onChange({ ...filters, level: valor as CenterFilters['level'] })}
          options={[
            {
              value: 'all',
              label: 'Todos',
              description: 'Sin filtrar: tutoriales de cualquier nivel.',
            },
            ...LEVELS.map((item) => ({
              value: item, // sin-ayuda: el rótulo ya nombra el valor del filtro
              label: TUTORIAL_LEVEL_LABELS[item],
            })),
          ]}
        />
      </Field>

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
