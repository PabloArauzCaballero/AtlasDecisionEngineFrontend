'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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

const CUSTOM = '__custom__';

/**
 * Catalog-backed field with defined values. Renders a real <select> of the
 * catalog options plus an "＋ Otro valor…" escape that reveals a text input, so
 * defined-value fields are selects (not free text) without trapping the user:
 * a brand-new value can still be created. Falls back to a plain input when the
 * catalog endpoint is unavailable or empty.
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
  const [custom, setCustom] = useState(false);
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

  const noCatalog = catalog.isError || (!catalog.isPending && options.length === 0);
  const inList = value !== '' && options.some((option) => option.value === value);
  const asText = noCatalog || custom || (value !== '' && !inList);

  return (
    <label className="field">
      <span>{label}</span>
      {asText ? (
        <>
          <input
            value={value}
            required={required}
            placeholder={placeholder ?? 'Escribe el valor'}
            onChange={(event) => onChange(event.target.value)}
          />
          {!noCatalog ? (
            <button
              type="button"
              className="field-inline-link"
              onClick={() => {
                setCustom(false);
                onChange('');
              }}
            >
              ← Elegir de la lista
            </button>
          ) : null}
        </>
      ) : (
        <select
          value={value}
          required={required}
          onChange={(event) => {
            if (event.target.value === CUSTOM) {
              setCustom(true);
              onChange('');
            } else {
              onChange(event.target.value);
            }
          }}
        >
          <option value="">{catalog.isPending ? 'Cargando…' : (placeholder ?? 'Elegir…')}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM}>＋ Otro valor…</option>
        </select>
      )}
    </label>
  );
}
