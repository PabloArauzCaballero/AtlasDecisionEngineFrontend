import { createContext } from 'react';
import type { InteractiveTutorial } from './interactive-types';

export interface StartOptions {
  /** Retoma el último paso guardado en lugar de empezar de cero. */
  resume?: boolean;
  /** Reinicio explícito tras haberlo completado: cuenta una repetición. */
  repeat?: boolean;
}

export interface InteractiveTutorialValue {
  tutorial: InteractiveTutorial | null;
  stepIndex: number;
  /** Inicia el tutorial con ese id (si existe). */
  start: (tutorialId: string, options?: StartOptions) => void;
  /** Inicia el tutorial mapeado a un código de error. Devuelve true si existe. */
  startForError: (code: string) => boolean;
  next: () => void;
  previous: () => void;
  exit: () => void;
}

export const InteractiveTutorialContext = createContext<InteractiveTutorialValue | null>(null);
