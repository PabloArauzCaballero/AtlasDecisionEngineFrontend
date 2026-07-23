'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sincroniza la pestaña activa con un parámetro de la URL (por defecto `?tab=`).
 * Así la pestaña se conserva al volver desde una vista secundaria o al compartir
 * el enlace. Hidrata desde la URL una sola vez al montar (para no pisar los
 * clics posteriores) y usa `replaceState` para no llenar el historial.
 */
export function useTabParam(
  tabIds: readonly string[],
  defaultId: string,
  param = 'tab',
): readonly [string, (id: string) => void] {
  const [active, setActive] = useState(defaultId);
  const idsRef = useRef(tabIds);
  idsRef.current = tabIds;
  const paramRef = useRef(param);
  paramRef.current = param;

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(paramRef.current);
    if (fromUrl && idsRef.current.includes(fromUrl)) setActive(fromUrl);
  }, []);

  const change = useCallback((id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set(paramRef.current, id);
    window.history.replaceState(null, '', url.toString());
  }, []);

  return [active, change] as const;
}
