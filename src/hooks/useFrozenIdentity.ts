'use client';

import { useEffect, useRef } from 'react';

/**
 * Desborde (px) a partir del cual tiene sentido anclar la columna de identidad.
 *
 * Anclarla tapa a su vecina mientras se desplaza: con una tabla que sólo se pasa
 * del marco por 55 px, «Algoritmo» (213 px) escondía el valor de «Versión» y la
 * cabecera quedaba cortada, para evitar perder de vista un nombre que ni
 * siquiera llegaba a salirse. Sólo compensa cuando lo que queda fuera es mucho.
 */
export const FREEZE_OVERFLOW_PX = 200;

/**
 * Se engancha a la `<table>` y marca su `.data-table` con `data-frozen` cuando el
 * desborde horizontal justifica anclar la primera columna. Va como atributo del
 * DOM y no como clase: React reescribe `className` al cambiar la densidad y se
 * llevaría la marca por delante.
 */
export function useFrozenIdentity() {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = ref.current;
    const wrap = table?.closest<HTMLElement>('.table-wrap');
    const root = table?.closest<HTMLElement>('.data-table');
    if (!table || !wrap || !root || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const frozen = wrap.scrollWidth - wrap.clientWidth >= FREEZE_OVERFLOW_PX;
      if (frozen) root.setAttribute('data-frozen', '');
      else root.removeAttribute('data-frozen');
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    observer.observe(table);
    return () => observer.disconnect();
  }, []);

  return ref;
}
