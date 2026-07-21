import { createContext } from 'react';

export interface TutorialContextValue {
  active: boolean;
  stepIndex: number;
  totalSteps: number;
  completed: boolean;
  start: () => void;
  next: () => void;
  previous: () => void;
  exit: () => void;
}

export const TutorialContext = createContext<TutorialContextValue | null>(null);
