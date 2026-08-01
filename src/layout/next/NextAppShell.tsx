'use client';

import { usePathname } from 'next/navigation';
import { useState, type PropsWithChildren } from 'react';
import { AmbientProvider } from '../../components/ambient/AmbientProvider';
import { InteractiveTutorialProvider } from '../../features/tutorial/InteractiveTutorialProvider';
import { TutorialProvider } from '../../features/tutorial/TutorialProvider';
import { ViewExplainer } from '../../features/view-explainer/ViewExplainer';
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
        <InteractiveTutorialProvider>
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
            {/* El fondo ambiental envuelve al marco entero, no a cada página:
                se monta una sola vez por sesión y elige su variante según la
                ruta, así toda vista —incluidas las futuras— lo hereda. */}
            <AmbientProvider>
              <div className="app-main">
                <NextTopbar onMenu={() => setMenuOpen(true)} />
                <main className="content" id="main-content" tabIndex={-1}>
                  {/*
            Keying on the pathname remounts the view on each route change, which
            replays the entrance animation so every navigation has a visible
            arrival. Query data survives it — the cache lives in QueryProvider.
          */}
                  <div className="route-view" key={pathname}>
                    <ViewExplainer />
                    {children}
                  </div>
                </main>
              </div>
            </AmbientProvider>
            <ToastViewport />
          </div>
        </InteractiveTutorialProvider>
      </TutorialProvider>
    </UnsavedChangesProvider>
  );
}
