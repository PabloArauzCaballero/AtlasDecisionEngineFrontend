'use client';

import { createContext } from 'react';
import type { AmbientState } from '../AmbientBackground';

export interface AmbientContextValue {
  /**
   * Publica el estado real de la vista activa. Devuelve una función para
   * retirarlo: cuando la vista se desmonta, el fondo vuelve a reposo en lugar
   * de quedarse teñido por una operación que ya terminó.
   */
  publish: (state: AmbientState) => () => void;
}

/**
 * `null` cuando no hay proveedor: el fondo es decoración, así que una vista
 * renderizada fuera del shell (una prueba aislada) no debe romperse por ello.
 */
export const AmbientContext = createContext<AmbientContextValue | null>(null);
