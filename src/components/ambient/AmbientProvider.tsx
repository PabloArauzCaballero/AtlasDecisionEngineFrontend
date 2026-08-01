'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AmbientBackground, type AmbientState } from '../AmbientBackground';
import { ambientVariantFor } from './ambient-routes';
import { AmbientContext } from './AmbientContext';

/** Prioridad al resolver estados simultáneos: manda el más urgente. */
const RANK: Record<AmbientState, number> = {
  idle: 0,
  success: 1,
  running: 2,
  warning: 3,
  error: 4,
};

function strongest(states: Iterable<AmbientState>): AmbientState {
  let best: AmbientState = 'idle';
  for (const candidate of states) {
    if (RANK[candidate] > RANK[best]) best = candidate;
  }
  return best;
}

/**
 * Fondo ambiental del portal, único para toda la aplicación.
 *
 * Vive en el marco y no en cada página: la variante sale de la ruta y el estado
 * lo publican las vistas con `useAmbientState`. Hay un solo fondo montado en
 * todo momento, así que cambiar de sección no vuelve a crear sus capas ni sus
 * animaciones — el coste es constante por sesión, no por navegación.
 *
 * Cuando coinciden varios estados (una tabla cargando mientras otra falló) gana
 * el más urgente: un fallo nunca queda tapado por un "en curso". El registro de
 * publicaciones vive en un `ref` y no en el estado porque se escribe desde los
 * efectos de las vistas y debe leerse de forma síncrona.
 */
export function AmbientProvider({ children }: PropsWithChildren) {
  const pathname = usePathname() ?? '';
  const entries = useRef(new Map<number, AmbientState>());
  const nextId = useRef(0);
  const [state, setState] = useState<AmbientState>('idle');

  const publish = useCallback((published: AmbientState) => {
    const id = ++nextId.current;
    entries.current.set(id, published);
    setState(strongest(entries.current.values()));
    return () => {
      entries.current.delete(id);
      setState(strongest(entries.current.values()));
    };
  }, []);

  const value = useMemo(() => ({ publish }), [publish]);

  return (
    <AmbientContext.Provider value={value}>
      <AmbientBackground variant={ambientVariantFor(pathname)} state={state} />
      {children}
    </AmbientContext.Provider>
  );
}
