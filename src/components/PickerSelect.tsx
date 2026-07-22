'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http-client';
import { asRows, type UnknownRecord } from '../utils/records';

export interface PickerOption {
  value: string;
  label: string;
}

interface PickerSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Read-model endpoint returning an array (or a paged `{items}` envelope). */
  endpoint: string;
  queryKey: string;
  mapOption: (row: UnknownRecord) => PickerOption | null;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Entity reference field backed by a read-model picker endpoint. Renders a
 * select with the catalog options; if the picker cannot be loaded it degrades
 * to a plain input so the flow never blocks on the read layer.
 */
export function PickerSelect({
  label,
  value,
  onChange,
  endpoint,
  queryKey,
  mapOption,
  placeholder = 'Elegir…',
  required = false,
  disabled = false,
}: PickerSelectProps) {
  const picker = useQuery({
    queryKey: ['picker', queryKey, endpoint],
    queryFn: () => apiRequest<unknown>(endpoint),
    staleTime: 60_000,
  });

  const rows = Array.isArray(picker.data)
    ? asRows(picker.data)
    : asRows((picker.data as UnknownRecord | undefined)?.items);
  const options = rows
    .map(mapOption)
    .filter((option): option is PickerOption => option !== null && option.value !== '');

  // Degrade to a free input when the catalog fails OR resolves empty (endpoint not
  // deployed yet, or no values recorded). Creation must never be blocked by the
  // read layer, and an empty select would trap the user with no valid choice.
  const isEmpty = !picker.isPending && options.length === 0;
  if (picker.isError || isEmpty) {
    return (
      <label className="field picker-select">
        <span>{label}</span>
        <input
          value={value}
          required={required}
          disabled={disabled}
          placeholder="Escribe el valor manualmente"
          onChange={(event) => onChange(event.target.value)}
        />
        <small className="picker-fallback-note">
          {picker.isError
            ? 'Catálogo no disponible: escribe el valor.'
            : 'Catálogo vacío: escribe el valor.'}
        </small>
      </label>
    );
  }

  const hasCurrent = value !== '' && options.some((option) => option.value === value);

  return (
    <label className="field picker-select">
      <span>{label}</span>
      <select
        value={value}
        required={required}
        disabled={disabled || picker.isPending}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{picker.isPending ? 'Cargando catálogo…' : placeholder}</option>
        {!hasCurrent && value !== '' ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
