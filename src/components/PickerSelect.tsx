'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http-client';
import type { Option } from '../contracts/option';
import { asRows, type UnknownRecord } from '../utils/records';
import { FieldRow } from './FieldRow';
import { OptionSelect } from './OptionSelect';

/** El tipo de opción es uno solo en todo el repositorio. */
export type PickerOption = Option;

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
  /** Qué elige este campo y por qué importa. Pinta el ⓘ junto a la etiqueta. */
  help?: string;
  /** Nombre del control para el formulario y para `data-testid`. */
  name?: string;
}

/**
 * Entity reference field backed by a read-model picker endpoint. Renders an
 * `OptionSelect` with the catalog options; if the picker cannot be loaded it
 * degrades to a plain input so the flow never blocks on the read layer.
 *
 * Las opciones son ENTIDADES (un artefacto, una versión, un caso), así que su
 * descripción es la ficha resumida que arme `mapOption` —código · nombre— y
 * nunca un significado inventado: de un identificador que sale de los datos no
 * se puede decir «qué significa y cuándo elegirlo» sin mentir.
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
  help,
  name,
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
  const field = name ?? queryKey;

  // Degrade to a free input when the catalog fails OR resolves empty (endpoint not
  // deployed yet, or no values recorded). Creation must never be blocked by the
  // read layer, and an empty select would trap the user with no valid choice.
  const isEmpty = !picker.isPending && options.length === 0;
  if (picker.isError || isEmpty) {
    return (
      <FieldRow
        label={label}
        tooltip={help}
        required={required}
        className="picker-select"
        hint={
          picker.isError
            ? 'Catálogo no disponible: escribe el valor.'
            : 'Catálogo vacío: escribe el valor.'
        }
      >
        {(control) => (
          <input
            {...control}
            value={value}
            required={required}
            disabled={disabled}
            placeholder="Escribe el valor manualmente"
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </FieldRow>
    );
  }

  const hasCurrent = value !== '' && options.some((option) => option.value === value);
  // Un valor que ya viene puesto y no está en el catálogo se conserva como
  // opción: sin él, abrir el formulario lo borraría en silencio.
  const withCurrent = !hasCurrent && value !== '' ? [{ value, label: value }, ...options] : options;

  return (
    <FieldRow label={label} tooltip={help} required={required} className="picker-select">
      {(control) => (
        <OptionSelect
          id={control.id}
          describedById={control['aria-describedby']}
          onFocus={control.onFocus}
          onBlur={control.onBlur}
          name={field}
          value={value}
          required={required}
          disabled={disabled || picker.isPending}
          placeholder={picker.isPending ? 'Cargando catálogo…' : placeholder}
          options={withCurrent}
          onChange={onChange}
        />
      )}
    </FieldRow>
  );
}
