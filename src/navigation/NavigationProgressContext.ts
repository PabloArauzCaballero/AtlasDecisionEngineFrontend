import { createContext } from 'react';

export interface NavigationProgressValue {
  /** True while at least one link navigation is in flight. */
  active: boolean;
  /** Reported by each link so the shell can show one shared progress bar. */
  setPending: (id: string, pending: boolean) => void;
}

export const NavigationProgressContext = createContext<NavigationProgressValue | null>(null);
