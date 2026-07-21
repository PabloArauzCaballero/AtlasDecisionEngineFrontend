'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { TutorialContext, type TutorialContextValue } from './TutorialContext';
import { TutorialOverlay } from './TutorialOverlay';
import { TUTORIAL_STEPS } from './tutorial-steps';

const STORAGE_KEY = 'atlas.tutorial.completed';

function readCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Private-browsing storage restrictions must not crash the app; the tutorial
    // simply won't remember completion across sessions in that case.
    return false;
  }
}

function writeCompleted(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    /* best effort — see readCompleted() */
  }
}

/**
 * Fase 4 — interactive tutorial. Mounted once inside the authenticated portal
 * shell (NextAppShell) so every page can render `<TutorialOverlay>` state and any
 * page can restart it via `useTutorial().start()` (e.g. a help button).
 */
export function TutorialProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setCompleted(readCompleted());
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      const step = TUTORIAL_STEPS[index];
      setStepIndex(index);
      if (step?.route) router.push(step.route);
    },
    [router],
  );

  const start = useCallback(() => {
    setActive(true);
    goToStep(0);
  }, [goToStep]);

  const finish = useCallback(() => {
    setActive(false);
    setCompleted(true);
    writeCompleted();
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      finish();
      return;
    }
    goToStep(stepIndex + 1);
  }, [stepIndex, goToStep, finish]);

  const previous = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  const exit = useCallback(() => {
    setActive(false);
  }, []);

  const value: TutorialContextValue = {
    active,
    stepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    completed,
    start,
    next,
    previous,
    exit,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {active ? <TutorialOverlay step={TUTORIAL_STEPS[stepIndex]} /> : null}
    </TutorialContext.Provider>
  );
}
