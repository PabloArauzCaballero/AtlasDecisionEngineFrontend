import { useContext } from 'react';
import { TutorialContext } from './TutorialContext';

export function useTutorial() {
  const value = useContext(TutorialContext);
  if (!value) throw new Error('useTutorial debe utilizarse dentro de TutorialProvider.');
  return value;
}
