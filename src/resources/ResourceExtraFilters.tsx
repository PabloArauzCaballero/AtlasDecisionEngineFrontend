import { FilterSelect } from '../components/FilterSelect';
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
            label={extra.label}
            value={draftExtra[extra.param] ?? ''}
            endpoint={extra.picker?.endpoint ?? extra.optionsEndpoint ?? ''}
            valueKey={extra.picker?.valueKey}
            labelKeys={extra.picker?.labelKeys}
            placeholder={extra.placeholder}
            onChange={(value) => applySelectFilter(extra.param, value)}
          />
        ) : (
          <label key={extra.param}>
            <span>{extra.label}</span>
            {extra.options ? (
              <select
                value={draftExtra[extra.param] ?? ''}
                onChange={(event) => applySelectFilter(extra.param, event.target.value)}
              >
                <option value="">Todos</option>
                {extra.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={extra.inputType ?? 'text'}
                value={draftExtra[extra.param] ?? ''}
                placeholder={extra.placeholder}
                onChange={(event) =>
                  setDraftExtra((prev) => ({ ...prev, [extra.param]: event.target.value }))
                }
              />
            )}
          </label>
        ),
      )}
    </>
  );
}
