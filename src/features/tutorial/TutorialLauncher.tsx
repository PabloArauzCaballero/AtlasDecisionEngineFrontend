'use client';

import { GraduationCap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { resolveTutorial } from './tutorial-content';
import { TutorialDrawer } from './TutorialDrawer';
import { useTutorial } from './useTutorial';

const SEEN_KEY = 'atlas.tutorial.seen';

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Route-aware help button in the topbar. Opens the tutorial for the current
 * tool and, until it has been opened once (tracked in localStorage), pulses so
 * new users notice help is available. Renders nothing on routes without a tutorial.
 */
export function TutorialLauncher() {
  const pathname = usePathname() ?? '';
  const tutorial = resolveTutorial(pathname);
  const { start } = useTutorial();
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    if (!tutorial) {
      setUnseen(false);
      return;
    }
    setUnseen(!readSeen().includes(pathname));
  }, [pathname, tutorial]);

  if (!tutorial) return null;

  const launch = () => {
    setOpen(true);
    setUnseen(false);
    const seen = readSeen();
    if (!seen.includes(pathname)) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, pathname]));
      } catch {
        // A private-mode storage failure must not block the tutorial itself.
      }
    }
  };

  return (
    <>
      <button
        className={
          unseen ? 'icon-button tutorial-trigger has-unseen' : 'icon-button tutorial-trigger'
        }
        type="button"
        onClick={launch}
        aria-label={`Tutorial: ${tutorial.title}`}
        title={`Tutorial de ${tutorial.title}`}
      >
        <GraduationCap />
      </button>
      {open ? (
        <TutorialDrawer
          tutorial={tutorial}
          onClose={() => setOpen(false)}
          onStartTour={() => {
            setOpen(false);
            start();
          }}
        />
      ) : null}
    </>
  );
}
