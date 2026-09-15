'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../api/http-client';
import type { Option } from '../contracts/option';
import { asRows, type UnknownRecord } from '../utils/records';
import { FieldRow } from './FieldRow';
import { OptionSelect } from './OptionSelect';

/** El tipo de opción es uno solo en todo el repositorio. */
export type CatalogOption = Option;

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
  /** Qué poner en el campo y por qué importa. Pinta el ⓘ junto a la etiqueta. */
  help?: string;
  /** Nombre del control para el formulario y para `data-testid`. */
  name?: string;
}

const CUSTOM = '__custom__';

/**
 * Catalog-backed field with defined values. Renders an `OptionSelect` of the
 * catalog options plus an "＋ Otro valor…" escape that reveals a text input, so
 * defined-value fields are chosen (not typed) without trapping the user: a
 * brand-new value can still be created. Falls back to a plain input when the
 * catalog endpoint is unavailable or empty.
 *
 * Las opciones vienen de `/v1/views/options`, que publica `value` y `label` y
 * —por ahora— no una descripción. No se inventa ninguna: una explicación
 * fabricada sobre un valor de catálogo es peor que ninguna. Cuando la vista
 * `vw_form_option` publique `description`, `mapOption` la traerá y las filas la
 * pintarán sin tocar nada más.
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
  help,
  name,
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
  const field = name ?? queryKey;

  return (
    <FieldRow label={label} tooltip={help} required={required}>
      {(control) =>
        asText ? (
          <>
            <input
              {...control}
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
          <OptionSelect
            id={control.id}
            describedById={control['aria-describedby']}
            onFocus={control.onFocus}
            onBlur={control.onBlur}
            name={field}
            value={value}
            required={required}
            disabled={catalog.isPending}
            placeholder={catalog.isPending ? 'Cargando…' : (placeholder ?? 'Elegir…')}
            options={[
              ...options,
              {
                value: CUSTOM,
                label: '＋ Otro valor…',
                description: 'El valor que necesitas no está en el catálogo: lo escribes a mano.',
              },
            ]}
            onChange={(next) => {
              if (next === CUSTOM) {
                setCustom(true);
                onChange('');
              } else {
                onChange(next);
              }
            }}
          />
        )
      }
    </FieldRow>
  );
}
