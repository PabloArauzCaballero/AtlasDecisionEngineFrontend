'use client';

import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { apiRequest } from '../api/http-client';
import { asRows, type UnknownRecord } from '../utils/records';

export interface CatalogOption {
  value: string;
  label: string;
}

interface CatalogInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Read-model endpoint returning `{ value, label }[]` (or a `{items}` envelope). */
  endpoint: string;
  queryKey: string;
  mapOption: (row: UnknownRecord) => CatalogOption | null;
  required?: boolean;
  placeholder?: string;
}

/**
 * Catalog-backed field that suggests existing values via a native <datalist> but
 * lets the user type a NEW value to create it inline. Unlike PickerSelect (strict
 * select), it never traps the user in the current catalog — creation drives the
 * catalog, not the other way around. Missing/empty catalog just means no
 * suggestions, so the plain input still works.
 */
export function CatalogInput({
  label,
  value,
  onChange,
  endpoint,
  queryKey,
  mapOption,
  required = false,
  placeholder,
}: CatalogInputProps) {
  const listId = useId();
  const catalog = useQuery({
    queryKey: ['catalog', queryKey, endpoint],
    queryFn: () => apiRequest<unknown>(endpoint),
    staleTime: 60_000,
  });

  const rows = Array.isArray(catalog.data)
    ? asRows(catalog.data)
    : asRows((catalog.data as UnknownRecord | undefined)?.items);
  const options = rows
    .map(mapOption)
    .filter((option): option is CatalogOption => option !== null && option.value !== '');

  return (
    <label className="field">
      <span>{label}</span>
      <input
        list={listId}
        value={value}
        required={required}
        placeholder={
          placeholder ?? (catalog.isPending ? 'Cargando catálogo…' : 'Elige o escribe uno nuevo')
        }
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
      <small className="field-hint">Elige de la lista o escribe un valor nuevo.</small>
    </label>
  );
}
