'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http-client';
import { asRows, display, type UnknownRecord } from '../utils/records';

interface FilterSelectProps {
  label: string;
  value: string;
  /** `/v1/views/options?group=…` catalog endpoint, or an entity picker endpoint. */
  endpoint: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Row key for the option value (defaults to `value`, the options-catalog shape). */
  valueKey?: string;
  /** Row keys joined with · for the label (defaults to `label`/`value`). */
  labelKeys?: readonly string[];
}

/**
 * Catalog-backed filter control: a real <select> whose options come from the
 * backend read-model, so a filter over an enum/catalog (categoría, ambiente…) is
 * chosen, not typed. Degrades to a free-text input when the catalog is unavailable
 * or empty, so filtering never breaks.
 */
export function FilterSelect({
  label,
  value,
  endpoint,
  placeholder,
  onChange,
  valueKey = 'value',
  labelKeys,
}: FilterSelectProps) {
  const catalog = useQuery({
    queryKey: ['filter-options', endpoint],
    queryFn: () => apiRequest<unknown>(endpoint),
    staleTime: 60_000,
  });
  const rows = Array.isArray(catalog.data)
    ? asRows(catalog.data)
    : asRows((catalog.data as UnknownRecord | undefined)?.items);
  const options = rows
    .map((row) => ({
      value: display(row, valueKey),
      label: labelKeys
        ? labelKeys.map((key) => display(row, key)).join(' · ')
        : display(row, 'label', 'value'),
    }))
    .filter((option) => option.value !== '—' && option.value !== '');
  const noCatalog = catalog.isError || (!catalog.isPending && options.length === 0);

  return (
    <label>
      <span>{label}</span>
      {noCatalog ? (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{catalog.isPending ? 'Cargando…' : 'Todos'}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
