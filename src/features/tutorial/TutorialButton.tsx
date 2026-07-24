'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';
import { tutorialById } from './interactive-catalog';
import { useInteractiveTutorial } from './useInteractiveTutorial';

/**
 * Acceso visible al tutorial interactivo de una sección/pestaña. Se coloca junto
 * al título. No renderiza nada si no hay tutorial para ese id.
 */
export function TutorialButton({ tutorialId }: { tutorialId: string }) {
  const { start } = useInteractiveTutorial();
  const tutorial = tutorialById(tutorialId);
  if (!tutorial) return null;

  return (
    <Tooltip content="Iniciar tutorial interactivo de esta sección">
      <button
        type="button"
        className="tutorial-button"
        aria-label={`Iniciar tutorial interactivo de ${tutorial.title}`}
        onClick={() => start(tutorialId)}
      >
        <HelpCircle size={15} aria-hidden /> Tutorial
      </button>
    </Tooltip>
  );
}
