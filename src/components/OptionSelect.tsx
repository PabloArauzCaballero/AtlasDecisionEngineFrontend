'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import type { Option } from '../contracts/option';
import { OptionSelectList } from './OptionSelectList';
import { useOptionSelect } from './useOptionSelect';

interface OptionSelectProps {
  /** Nombre del control oculto que lleva el valor al formulario. */
  name: string;
  /** `id` del botón, para el `htmlFor` de `FieldLabel`. */
  id?: string;
  options: readonly Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Texto cuando el catálogo no trae nada. */
  emptyLabel?: string;
  /** `id` del texto de ayuda del campo (`useFieldHelp`). */
  describedById?: string;
  /** Nombre accesible cuando no hay `FieldLabel` (barras de filtros, tablas). */
  ariaLabel?: string;
  /** `data-testid` del botón; por omisión `select-<name>`. */
  testId?: string;
  className?: string;
  /** Reducido, para las barras de filtros: no repite la descripción debajo. */
  compact?: boolean;
}

/**
 * Un desplegable con explicación por opción.
 *
 * Un `<option>` nativo no admite ayuda propia: `title=` no se pinta en
 * Safari/macOS ni en el móvil y no lo lee el lector de pantalla, así que una
 * lista de estados, tipos o políticas era una lista de palabras a adivinar.
 * Aquí cada fila lleva su `description` a la vista y la elegida la repite bajo
 * el campo. Es un combobox ARIA (botón + `listbox`) con teclado completo:
 * flechas, Inicio/Fin, escribir para saltar, Enter para elegir, Escape para
 * cerrar, Tab para salir. Con más de ocho opciones aparece un buscador que
 * filtra por etiqueta y por descripción, sin tildes.
 *
 * El valor viaja en un `<input>` visualmente oculto pero NO `type="hidden"`: el
 * navegador no valida `required` en un oculto. Al elegir se dispara `input` y
 * `change` nativos sobre ese control, para que un `onChange` del `<form>` —el
 * que recarga campos dependientes— se entere igual que con un select nativo.
 */
export function OptionSelect(props: OptionSelectProps) {
  const controlled = props.value !== undefined;
  const [internal, setInternal] = useState(props.defaultValue ?? '');
  const value = controlled ? (props.value ?? '') : internal;
  const [hidden, setHidden] = useState<HTMLInputElement | null>(null);
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const listId = `${id}-lista`;

  const { onChange } = props;
  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      if (hidden && hidden.value !== next) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(hidden, next);
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
      onChange?.(next);
    },
    [controlled, hidden, onChange],
  );

  const isEmpty = props.options.length === 0;
  const select = useOptionSelect({
    options: props.options,
    value,
    commit,
    disabled: props.disabled || isEmpty,
  });
  const selected = props.options.find((option) => option.value === value);
  const activeId =
    select.open && select.visible[select.active] ? `${listId}-${select.active}` : undefined;

  return (
    <span className={props.className ? `option-select ${props.className}` : 'option-select'}>
      <input
        ref={setHidden}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={props.name}
        value={value}
        required={props.required}
        disabled={props.disabled}
        onChange={() => {}}
      />
      <button
        ref={select.buttonRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={select.open}
        aria-controls={select.open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-describedby={props.describedById}
        aria-label={props.ariaLabel}
        aria-required={props.required}
        data-testid={props.testId ?? `select-${props.name}`}
        data-value={value}
        data-placeholder={!selected || undefined}
        disabled={props.disabled || isEmpty}
        className="option-select-button"
        onClick={() => (select.open ? select.close() : select.setOpen(true))}
        onKeyDown={select.onKeyDown}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
      >
        <span className="option-select-value">
          {isEmpty
            ? (props.emptyLabel ?? '— No hay datos registrados —')
            : (selected?.label ?? props.placeholder ?? 'Elige una opción')}
        </span>
        {select.open ? (
          <ChevronUp size={16} aria-hidden="true" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" />
        )}
      </button>
      {selected?.description && !props.compact ? (
        <span className="option-select-chosen" data-testid={`select-${props.name}-descripcion`}>
          {selected.description}
        </span>
      ) : null}
      {select.open ? (
        <OptionSelectList
          name={props.name}
          listId={listId}
          buttonId={id}
          rect={select.rect}
          visible={select.visible}
          value={value}
          active={select.active}
          setActive={select.setActive}
          choose={select.choose}
          onKeyDown={select.onKeyDown}
          searchable={select.searchable}
          search={select.search}
          setSearch={select.setSearch}
          searchRef={select.searchRef}
          listRef={select.listRef}
          activeId={activeId}
        />
      ) : null}
    </span>
  );
}
