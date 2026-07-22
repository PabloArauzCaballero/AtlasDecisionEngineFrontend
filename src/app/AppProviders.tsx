'use client';

import type { PropsWithChildren } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { NavigationProgressProvider } from '../navigation/NavigationProgressProvider';
import { NotificationProvider } from '../notifications/NotificationProvider';
import { QueryProvider } from './QueryProvider';

/**
 * Creates the client-side provider tree used by App Router.
 *
 * Notifications sit outermost so the query client can report failures through
 * them, and so every surface below — including error boundaries — can raise a
 * toast. The QueryClient itself is owned by QueryProvider, which keeps it to a
 * single instance per browser session.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <NotificationProvider>
      <NavigationProgressProvider>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </NavigationProgressProvider>
    </NotificationProvider>
  );
}
