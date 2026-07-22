'use client';

import { usePathname } from 'next/navigation';
import { useState, type PropsWithChildren } from 'react';
import { TutorialProvider } from '../../features/tutorial/TutorialProvider';
import { RouteProgress } from '../../navigation/RouteProgress';
import { ToastViewport } from '../../notifications/ToastViewport';
import { UnsavedChangesProvider } from '../../shared/navigation/unsaved-changes';
import { NextSidebar } from './NextSidebar';
import { NextTopbar } from './NextTopbar';

export function NextAppShell({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname() ?? '';

  return (
    <UnsavedChangesProvider>
      <TutorialProvider>
        <div className="app-shell">
          <RouteProgress />
          <NextSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
          {menuOpen ? (
            <button
              className="sidebar-backdrop"
              type="button"
              aria-label="Cerrar navegación"
              onClick={() => setMenuOpen(false)}
            />
          ) : null}
          <div className="app-main">
            <NextTopbar onMenu={() => setMenuOpen(true)} />
            <main className="content" id="main-content" tabIndex={-1}>
              {/*
            Keying on the pathname remounts the view on each route change, which
            replays the entrance animation so every navigation has a visible
            arrival. Query data survives it — the cache lives in QueryProvider.
          */}
              <div className="route-view" key={pathname}>
                {children}
              </div>
            </main>
          </div>
          <ToastViewport />
        </div>
      </TutorialProvider>
    </UnsavedChangesProvider>
  );
}
