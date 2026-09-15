'use client';

import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Option } from '../contracts/option';
import type { PopupRect } from './useOptionSelect';

interface OptionSelectListProps {
  name: string;
  listId: string;
  buttonId: string;
  rect: PopupRect | null;
  visible: readonly Option[];
  value: string;
  active: number;
  setActive: (index: number) => void;
  choose: (option: Option) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  searchable: boolean;
  search: string;
  setSearch: (text: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLUListElement | null>;
  activeId?: string;
}

/**
 * La lista desplegada de un `OptionSelect`, en un portal sobre `document.body`.
 *
 * Va en un portal por lo mismo que los globos de ayuda: dentro del campo, un
 * ancestro con `overflow` la recorta y ningún `z-index` la saca del contexto de
 * apilamiento donde nació. Cada fila lleva su descripción a la vista —es lo que
 * un `<option>` nativo no puede hacer— y `title` la repite entera cuando el
 * recorte a dos líneas la deja a medias.
 */
export function OptionSelectList(props: OptionSelectListProps) {
  if (typeof document === 'undefined') return null;
  const { rect } = props;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: rect?.left ?? -9999,
    width: rect?.width ?? 240,
    ...(rect?.up
      ? { bottom: Math.max(0, window.innerHeight - rect.top) }
      : { top: rect?.top ?? -9999 }),
  };
  return createPortal(
    <div className="option-select-popup" style={style} onKeyDown={props.onKeyDown}>
      {props.searchable ? (
        <div className="option-select-search">
          <input
            ref={props.searchRef}
            type="search"
            aria-label="Buscar una opción"
            aria-controls={props.listId}
            aria-activedescendant={props.activeId}
            value={props.search}
            placeholder="Escribe para filtrar…"
            onChange={(event) => {
              props.setSearch(event.target.value);
              props.setActive(0);
            }}
          />
        </div>
      ) : null}
      <ul
        ref={props.listRef}
        id={props.listId}
        role="listbox"
        aria-labelledby={props.buttonId}
        className="option-select-list"
        tabIndex={-1}
      >
        {props.visible.length === 0 ? (
          <li className="option-select-none">Ninguna opción coincide.</li>
        ) : (
          props.visible.map((option, index) => (
            <li
              key={option.value || `vacio-${index}`}
              id={`${props.listId}-${index}`}
              role="option"
              aria-selected={option.value === props.value}
              aria-disabled={option.disabled || undefined}
              data-index={index}
              data-active={index === props.active || undefined}
              data-testid={`select-${props.name}-option-${option.value}`}
              title={option.description}
              className="option-select-option"
              onMouseEnter={() => props.setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => props.choose(option)}
            >
              <span className="option-select-option-label">{option.label || ' '}</span>
              {option.description ? (
                <span className="option-select-option-desc">{option.description}</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>,
    document.body,
  );
}
