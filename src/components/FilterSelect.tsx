'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http-client';
import { asRows, display, type UnknownRecord } from '../utils/records';
import { FieldRow } from './FieldRow';
import { OptionSelect } from './OptionSelect';

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
  /** Qué acota este filtro y por qué importa. Pinta el ⓘ junto a la etiqueta. */
  help?: string;
  /** Nombre del control, para `data-testid` y para el formulario. */
  name?: string;
}

/**
 * Catalog-backed filter control: an `OptionSelect` whose options come from the
 * backend read-model, so a filter over an enum/catalog (categoría, ambiente…) is
 * chosen, not typed. Degrades to a free-text input when the catalog is unavailable
 * or empty, so filtering never breaks.
 *
 * Las opciones salen de los DATOS y llegan con `value`/`label`: no se les
 * inventa descripción. La ayuda que sí se escribe es la del filtro entero, que
 * es donde había que explicar qué acota.
 */
export function FilterSelect({
  label,
  value,
  endpoint,
  placeholder,
  onChange,
  valueKey = 'value',
  labelKeys,
  help,
  name,
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
  const field = name ?? valueKey;

  return (
    <FieldRow label={label} tooltip={help}>
      {(control) =>
        noCatalog ? (
          <input
            {...control}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <OptionSelect
            id={control.id}
            describedById={control['aria-describedby']}
            onFocus={control.onFocus}
            onBlur={control.onBlur}
            compact
            name={field}
            value={value}
            options={[
              { value: '', label: 'Todos', description: 'Sin acotar por este campo.' },
              ...options,
            ]}
            placeholder={catalog.isPending ? 'Cargando…' : 'Todos'}
            onChange={onChange}
          />
        )
      }
    </FieldRow>
  );
}
