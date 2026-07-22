'use client';

import { useEffect, useState } from 'react';
import { useNavigationProgress } from './useNavigationProgress';

/** Must outlast the finish animation in navigation.css. */
const FINISH_MS = 260;

type Phase = 'idle' | 'loading' | 'finishing';

/**
 * Top-of-viewport progress bar for route changes.
 *
 * The bar creeps toward 90% while a navigation is pending and snaps to 100% on
 * arrival — the familiar pattern, because a route can take an unknown amount of
 * time and a real percentage is not available.
 */
export function RouteProgress() {
  const { active } = useNavigationProgress();
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    if (active) {
      setPhase('loading');
      return;
    }
    // Only run the finish animation for a navigation we actually started.
    if (phase !== 'loading') return;
    setPhase('finishing');
    const timeout = setTimeout(() => setPhase('idle'), FINISH_MS);
    return () => clearTimeout(timeout);
  }, [active, phase]);

  if (phase === 'idle') return null;

  return (
    <div className="route-progress" aria-hidden="true">
      <span className="route-progress-bar" data-phase={phase} />
    </div>
  );
}
