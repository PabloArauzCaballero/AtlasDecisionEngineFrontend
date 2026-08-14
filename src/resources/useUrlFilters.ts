'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ResourceConfig } from './resource.types';

/**
 * Los filtros de un listado viven en la URL.
 *
 * Se extrae de `ResourceListPage` porque es una unidad completa con su propia razón de ser, y
 * porque esa página pasó de 299 líneas al añadir las acciones por fila — el límite del
 * repositorio obliga a partir por algún sitio, y partir por aquí deja las dos mitades legibles
 * en vez de dejar media función colgando.
 *
 * Lo que sostiene:
 *
 * - **Al montar se leen de la URL.** Las pantallas de detalle enlazan con `?filter=`, y una vista
 *   filtrada que alguien guardó en marcadores o pegó en un chat tiene que volver igual. Se hace
 *   después del montaje para que servidor y cliente pinten lo mismo en el primer render.
 * - **Al aplicar se escriben en la URL**, con `replaceState` y no `pushState`: cada tecleo en un
 *   filtro no es un paso atrás en el historial.
 * - **Se sincroniza lo APLICADO, no el borrador.** Es la distinción que hace compartible el
 *   enlace: la URL describe lo que se está viendo, no lo que alguien estaba escribiendo cuando
 *   copió la dirección.
 */
export interface UrlFiltersState {
  /** Texto aplicado: el que va a la consulta. */
  filter: string;
  /** Texto en edición, aún sin aplicar. */
  draftFilter: string;
  setDraftFilter: (value: string) => void;
  /** Filtros extra aplicados, por parámetro. */
  extraFilters: Record<string, string>;
  draftExtra: Record<string, string>;
  setDraftExtra: Dispatch<SetStateAction<Record<string, string>>>;
  /**
   * Aplica DE INMEDIATO, sin pasar por el borrador.
   *
   * Un desplegable se lee como «aplicar ahora», no como «escribir y luego enviar»; lo mismo el
   * selector de entidad y el aspa de un chip. Obligar a enviar después convierte un gesto que
   * ya estaba terminado en dos.
   */
  applyNow: (cambios: { filter?: string; extra?: Record<string, string> }) => void;
  showExtraFilters: boolean;
  setShowExtraFilters: Dispatch<SetStateAction<boolean>>;
  /** Pasa los borradores a aplicados y vuelve a la primera página. */
  apply: () => void;
  clear: () => void;
  hasActiveFilters: boolean;
  activeExtraCount: number;
}

export function useUrlFilters(config: ResourceConfig, onChange: () => void): UrlFiltersState {
  const [draftFilter, setDraftFilter] = useState('');
  const [filter, setFilter] = useState('');
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});
  const [draftExtra, setDraftExtra] = useState<Record<string, string>>({});
  const [showExtraFilters, setShowExtraFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('filter');
    if (initial) {
      setDraftFilter(initial);
      setFilter(initial);
    }
    const extra: Record<string, string> = {};
    for (const entry of config.filters ?? []) {
      const value = params.get(entry.param);
      if (value) extra[entry.param] = value;
    }
    if (Object.keys(extra).length) {
      setDraftExtra(extra);
      setExtraFilters(extra);
      // Si venía filtrado por la URL, el panel se abre: si no, la vista enseña resultados
      // recortados y el control que explica por qué está plegado.
      setShowExtraFilters(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('filter');
    for (const entry of config.filters ?? []) params.delete(entry.param);
    if (filter.trim()) params.set('filter', filter.trim());
    for (const [param, value] of Object.entries(extraFilters)) {
      if (value.trim()) params.set(param, value.trim());
    }
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [filter, extraFilters, config.filters]);

  return {
    filter,
    draftFilter,
    setDraftFilter,
    extraFilters,
    draftExtra,
    setDraftExtra,
    showExtraFilters,
    setShowExtraFilters,
    applyNow: ({ filter: texto, extra }) => {
      if (texto !== undefined) {
        setDraftFilter(texto);
        setFilter(texto);
      }
      if (extra !== undefined) {
        setDraftExtra(extra);
        setExtraFilters(extra);
      }
      onChange();
    },
    apply: () => {
      setFilter(draftFilter);
      setExtraFilters(draftExtra);
      onChange();
    },
    clear: () => {
      setDraftFilter('');
      setFilter('');
      setDraftExtra({});
      setExtraFilters({});
      onChange();
    },
    hasActiveFilters:
      filter.trim() !== '' || Object.values(extraFilters).some((value) => value.trim() !== ''),
    activeExtraCount: Object.values(extraFilters).filter((value) => value.trim() !== '').length,
  };
}
