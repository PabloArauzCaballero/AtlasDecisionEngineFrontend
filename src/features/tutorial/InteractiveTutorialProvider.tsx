'use client';

import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { errorTutorial, tutorialById } from './interactive-catalog';
import {
  InteractiveTutorialContext,
  type InteractiveTutorialValue,
} from './InteractiveTutorialContext';
import { InteractiveTutorialOverlay } from './InteractiveTutorialOverlay';
import type { InteractiveTutorial } from './interactive-types';
import { useTutorialProgress } from './useTutorialProgress';

function targetExists(selector?: string): boolean {
  return selector ? Boolean(document.querySelector(selector)) : true;
}

/**
 * Devuelve el índice del siguiente paso "aplicable" desde `from` en la dirección
 * `dir`, saltando los pasos opcionales cuyo target no existe en el DOM. Si se
 * sale del rango devuelve -1 (fin del tutorial). Esto evita apuntar a elementos
 * inexistentes y salta funciones no disponibles sin bloquear la interfaz.
 */
function applicableIndex(tutorial: InteractiveTutorial, from: number, dir: 1 | -1): number {
  let index = from;
  while (index >= 0 && index < tutorial.steps.length) {
    const step = tutorial.steps[index];
    if (!step.optional || targetExists(step.target)) return index;
    index += dir;
  }
  return -1;
}

export function InteractiveTutorialProvider({ children }: PropsWithChildren) {
  const [tutorial, setTutorial] = useState<InteractiveTutorial | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const { markStarted, saveStep, markCompleted, markSkipped } = useTutorialProgress();

  const start = useCallback(
    (id: string) => {
      const found = tutorialById(id);
      if (!found) return;
      const first = applicableIndex(found, 0, 1);
      if (first === -1) return;
      setTutorial(found);
      setStepIndex(first);
      void markStarted(found.id, first);
    },
    [markStarted],
  );

  const startForError = useCallback(
    (code: string) => {
      const link = errorTutorial(code);
      if (!link) return false;
      start(link.tutorialId);
      return true;
    },
    [start],
  );

  const finish = useCallback(() => {
    if (tutorial) void markCompleted(tutorial.id);
    setTutorial(null);
    setStepIndex(0);
  }, [tutorial, markCompleted]);

  const exit = useCallback(() => {
    if (tutorial) void markSkipped(tutorial.id);
    setTutorial(null);
    setStepIndex(0);
  }, [tutorial, markSkipped]);

  const next = useCallback(() => {
    if (!tutorial) return;
    const target = applicableIndex(tutorial, stepIndex + 1, 1);
    if (target === -1) {
      finish();
      return;
    }
    setStepIndex(target);
    void saveStep(tutorial.id, target);
  }, [tutorial, stepIndex, finish, saveStep]);

  const previous = useCallback(() => {
    if (!tutorial) return;
    const target = applicableIndex(tutorial, stepIndex - 1, -1);
    if (target !== -1) setStepIndex(target);
  }, [tutorial, stepIndex]);

  const value: InteractiveTutorialValue = useMemo(
    () => ({ tutorial, stepIndex, start, startForError, next, previous, exit }),
    [tutorial, stepIndex, start, startForError, next, previous, exit],
  );

  return (
    <InteractiveTutorialContext.Provider value={value}>
      {children}
      {tutorial ? (
        <InteractiveTutorialOverlay
          tutorial={tutorial}
          stepIndex={stepIndex}
          onNext={next}
          onPrevious={previous}
          onExit={exit}
        />
      ) : null}
    </InteractiveTutorialContext.Provider>
  );
}
