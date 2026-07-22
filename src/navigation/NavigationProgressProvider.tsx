'use client';

import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { NavigationProgressContext } from './NavigationProgressContext';

/**
 * Collects the pending state of every navigation link on screen.
 *
 * Individual links report through `setPending`; the shell reads the aggregate
 * to drive a single top progress bar. Tracking ids rather than a counter keeps
 * the state idempotent — a link that reports `true` twice cannot leave the bar
 * stuck on.
 */
export function NavigationProgressProvider({ children }: PropsWithChildren) {
  const [pendingIds, setPendingIds] = useState<readonly string[]>([]);

  const setPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((current) => {
      const tracked = current.includes(id);
      if (pending === tracked) return current;
      return pending ? [...current, id] : current.filter((entry) => entry !== id);
    });
  }, []);

  const value = useMemo(
    () => ({ active: pendingIds.length > 0, setPending }),
    [pendingIds, setPending],
  );

  return (
    <NavigationProgressContext.Provider value={value}>
      {children}
    </NavigationProgressContext.Provider>
  );
}
