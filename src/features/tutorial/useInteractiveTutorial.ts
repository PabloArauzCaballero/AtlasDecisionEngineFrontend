import { useContext } from 'react';
import { InteractiveTutorialContext } from './InteractiveTutorialContext';

export function useInteractiveTutorial() {
  const value = useContext(InteractiveTutorialContext);
  if (!value) {
    throw new Error('useInteractiveTutorial requiere InteractiveTutorialProvider');
  }
  return value;
}
