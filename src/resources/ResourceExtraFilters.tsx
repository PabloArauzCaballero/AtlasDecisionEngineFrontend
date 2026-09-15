import { FieldRow } from '../components/FieldRow';
import { FilterSelect } from '../components/FilterSelect';
import { OptionSelect } from '../components/OptionSelect';
import type { ResourceFilter } from './resource.types';

interface ResourceExtraFiltersProps {
  filters: readonly ResourceFilter[];
  draftExtra: Record<string, string>;
  setDraftExtra: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  applySelectFilter: (param: string, value: string) => void;
}

/**
 * Renders the "Más filtros" controls: catalog/picker-backed selects, static
 * option selects, or typed free-text inputs (incl. date ranges). Extracted from
 * ResourceListPage to keep that file within the source-size budget.
 *
 * Cada filtro lleva su ⓘ (`help`, en `resource.filters.ts`) y cada opción de
 * dominio cerrado su descripción: un filtro de estados era una lista de códigos
 * en mayúsculas y había que elegir uno para averiguar qué acotaba.
 */
export function ResourceExtraFilters({
  filters,
  draftExtra,
  setDraftExtra,
  applySelectFilter,
}: ResourceExtraFiltersProps) {
  return (
    <>
      {filters.map((extra) =>
        extra.optionsEndpoint || extra.picker ? (
          <FilterSelect
            key={extra.param}
            name={extra.param}
            label={extra.label}
            help={extra.help}
            value={draftExtra[extra.param] ?? ''}
            endpoint={extra.picker?.endpoint ?? extra.optionsEndpoint ?? ''}
            valueKey={extra.picker?.valueKey}
            labelKeys={extra.picker?.labelKeys}
            placeholder={extra.placeholder}
            onChange={(value) => applySelectFilter(extra.param, value)}
          />
        ) : (
          <FieldRow key={extra.param} label={extra.label} tooltip={extra.help}>
            {(control) =>
              extra.options ? (
                <OptionSelect
                  id={control.id}
                  describedById={control['aria-describedby']}
                  onFocus={control.onFocus}
                  onBlur={control.onBlur}
                  compact
                  name={extra.param}
                  value={draftExtra[extra.param] ?? ''}
                  options={[
                    { value: '', label: 'Todos', description: 'Sin acotar por este campo.' },
                    ...extra.options,
                  ]}
                  placeholder="Todos"
                  onChange={(value) => applySelectFilter(extra.param, value)}
                />
              ) : (
                <input
                  {...control}
                  type={extra.inputType ?? 'text'}
                  value={draftExtra[extra.param] ?? ''}
                  placeholder={extra.placeholder}
                  onChange={(event) =>
                    setDraftExtra((prev) => ({ ...prev, [extra.param]: event.target.value }))
                  }
                />
              )
            }
          </FieldRow>
        ),
      )}
    </>
  );
}
