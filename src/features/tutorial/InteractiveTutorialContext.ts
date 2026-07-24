import { createContext } from 'react';
import type { InteractiveTutorial } from './interactive-types';

export interface InteractiveTutorialValue {
  tutorial: InteractiveTutorial | null;
  stepIndex: number;
  /** Inicia el tutorial con ese id (si existe). */
  start: (tutorialId: string) => void;
  /** Inicia el tutorial mapeado a un código de error. Devuelve true si existe. */
  startForError: (code: string) => boolean;
  next: () => void;
  previous: () => void;
  exit: () => void;
}

export const InteractiveTutorialContext = createContext<InteractiveTutorialValue | null>(null);
