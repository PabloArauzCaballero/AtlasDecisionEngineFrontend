'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http-client';
import { asRows, display, type UnknownRecord } from '../utils/records';

/**
 * La opción con la que una pantalla debería abrir, sacada del mismo selector que la usa.
 *
 * Varias pantallas —suites, casos, cobertura, monitoreo— abrían con el selector vacío y la tabla en
 * blanco aunque hubiera datos: había que elegir y pulsar «Cargar» para ver algo. Quien entraba por
 * primera vez leía «no hay nada» (2026-10-08). Ahora abren con la opción más reciente ya cargada,
 * y el selector sigue ahí para cambiarla.
 *
 * Comparte la clave de caché con `PickerSelect` (`['picker', queryKey, endpoint]`), así que no
 * añade ninguna petición: es la misma lista que el selector ya iba a pedir.
 *
 * Devuelve '' mientras carga, si está desactivado o si la lista viene vacía.
 */
export function usePickerDefault(options: {
  endpoint: string;
  queryKey: string;
  /** Desactívalo cuando la pantalla ya llega con una selección (enlace directo). */
  enabled: boolean;
  /** De qué campo de la fila sale el valor. Por omisión, `id`. */
  valueKey?: string;
  /** Orden de preferencia; gana la primera. Por omisión, el id más alto (la más reciente). */
  rank?: (a: UnknownRecord, b: UnknownRecord) => number;
}): string {
  const { endpoint, queryKey, enabled, valueKey = 'id', rank = newestFirst } = options;
  const picker = useQuery({
    queryKey: ['picker', queryKey, endpoint],
    queryFn: () => apiRequest<unknown>(endpoint),
    staleTime: 60_000,
    enabled,
  });
  if (!enabled || !picker.data) return '';
  const rows = Array.isArray(picker.data)
    ? asRows(picker.data)
    : asRows((picker.data as UnknownRecord).items);
  const best = [...rows].sort(rank)[0];
  if (!best) return '';
  const value = display(best, valueKey);
  return value === '—' ? '' : value;
}

/** Ids numéricos del Motor (bigint como texto): el más alto es el más reciente. */
export function newestFirst(a: UnknownRecord, b: UnknownRecord): number {
  const ia = BigInt(/^\d+$/.test(display(a, 'id')) ? display(a, 'id') : '0');
  const ib = BigInt(/^\d+$/.test(display(b, 'id')) ? display(b, 'id') : '0');
  return ia === ib ? 0 : ia > ib ? -1 : 1;
}
