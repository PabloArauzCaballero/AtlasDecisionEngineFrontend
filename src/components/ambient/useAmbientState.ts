'use client';

import { useContext, useEffect } from 'react';
import type { AmbientState } from '../AmbientBackground';
import { AmbientContext } from './AmbientContext';

/**
 * Publica el estado real de la vista en el fondo ambiental.
 *
 * Regla del producto: sólo se publica lo que está ocurriendo de verdad. Si una
 * vista no tiene nada en curso, no llama a este hook o publica `idle`; el fondo
 * no debe insinuar actividad que el backend no está haciendo.
 *
 * La publicación se retira al desmontar la vista, así que navegar fuera de una
 * pantalla que estaba ejecutando devuelve el fondo a reposo.
 */
export function useAmbientState(state: AmbientState): void {
  const ambient = useContext(AmbientContext);

  useEffect(() => {
    if (!ambient || state === 'idle') return;
    return ambient.publish(state);
  }, [ambient, state]);
}
