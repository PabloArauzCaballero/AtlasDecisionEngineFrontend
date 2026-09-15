'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Option } from '../contracts/option';

/** A partir de cuántas opciones aparece el buscador dentro de la lista. */
export const SEARCH_FROM = 8;
/** Alto máximo de la lista; el mismo que fija `option-select.css`. */
const LIST_MAX = 320;

export const sinTildes = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface PopupRect {
  top: number;
  left: number;
  width: number;
  up: boolean;
}

interface Params {
  options: readonly Option[];
  value: string;
  commit: (value: string) => void;
  disabled?: boolean;
}

/**
 * El estado de un `OptionSelect`: apertura, búsqueda, fila activa, colocación y
 * teclado. Vive aparte del componente por el tope de 299 líneas del repositorio
 * y porque es lo único que hay que probar sin pintar nada.
 */
export function useOptionSelect({ options, value, commit, disabled }: Params) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<PopupRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const typed = useRef({ text: '', at: 0 });

  const searchable = options.length > SEARCH_FROM;
  const visible = useMemo(() => {
    const term = sinTildes(search.trim());
    if (!term) return options;
    return options.filter((option) =>
      sinTildes(`${option.label} ${option.description ?? ''}`).includes(term),
    );
  }, [options, search]);

  const place = useCallback(() => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const height = Math.min(LIST_MAX, listRef.current?.offsetHeight ?? LIST_MAX);
    const below = window.innerHeight - anchor.bottom;
    const up = below < height + 8 && anchor.top > below;
    setRect({
      top: up ? anchor.top - 4 : anchor.bottom + 4,
      left: anchor.left,
      width: anchor.width,
      up,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place, visible.length]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    if (searchable) searchRef.current?.focus();
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, searchable]);

  // Al abrir, la fila activa es la elegida; si no hay, la primera.
  useEffect(() => {
    if (!open) return;
    const index = visible.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
  }, [open, visible, value]);

  useEffect(() => {
    if (!open) return;
    const fila = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    // jsdom no implementa `scrollIntoView`: sin la guarda, montar el componente
    // en una prueba revienta por una comodidad visual.
    if (typeof fila?.scrollIntoView === 'function') fila.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setSearch('');
    if (refocus) buttonRef.current?.focus();
  }, []);

  const choose = useCallback(
    (option: Option | undefined) => {
      if (!option || option.disabled) return;
      commit(option.value);
      close();
    },
    [close, commit],
  );

  /** Escribir salta a la primera opción que empieza por lo tecleado. */
  const jumpTo = useCallback(
    (key: string) => {
      const now = Date.now();
      typed.current = {
        text: now - typed.current.at < 800 ? typed.current.text + key : key,
        at: now,
      };
      const term = sinTildes(typed.current.text);
      const index = visible.findIndex((option) => sinTildes(option.label).startsWith(term));
      if (index >= 0) setActive(index);
    },
    [visible],
  );

  const onKeyDown = useCallback(
    (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
      if (disabled) return;
      const { key } = event;
      if (!open) {
        if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
          event.preventDefault();
          setOpen(true);
        }
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        setActive((current) => Math.min(current + 1, visible.length - 1));
      } else if (key === 'ArrowUp') {
        event.preventDefault();
        setActive((current) => Math.max(current - 1, 0));
      } else if (key === 'Home') {
        event.preventDefault();
        setActive(0);
      } else if (key === 'End') {
        event.preventDefault();
        setActive(visible.length - 1);
      } else if (key === 'Enter' || (key === ' ' && !searchable)) {
        event.preventDefault();
        choose(visible[active]);
      } else if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (key === 'Tab') {
        close(false);
      } else if (!searchable && key.length === 1 && /\S/.test(key)) {
        jumpTo(key);
      }
    },
    [active, choose, close, disabled, jumpTo, open, searchable, visible],
  );

  return {
    open,
    setOpen,
    search,
    setSearch,
    active,
    setActive,
    rect,
    visible,
    searchable,
    buttonRef,
    listRef,
    searchRef,
    close,
    choose,
    onKeyDown,
  };
}
