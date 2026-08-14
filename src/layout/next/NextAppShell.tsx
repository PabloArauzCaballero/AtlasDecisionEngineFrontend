'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type PropsWithChildren } from 'react';
import { SessionSecurityNotice } from '../../auth/SessionSecurityNotice';
import { AmbientProvider } from '../../components/ambient/AmbientProvider';
import { InteractiveTutorialProvider } from '../../features/tutorial/InteractiveTutorialProvider';
import { TutorialProvider } from '../../features/tutorial/TutorialProvider';
import { TutorialWelcomePrompt } from '../../features/tutorial/TutorialWelcomePrompt';
import { ViewExplainer } from '../../features/view-explainer/ViewExplainer';
import { RouteProgress } from '../../navigation/RouteProgress';
import { ToastViewport } from '../../notifications/ToastViewport';
import { UnsavedChangesProvider } from '../../shared/navigation/unsaved-changes';
import { NextSidebar } from './NextSidebar';
import { NextTopbar } from './NextTopbar';

export function NextAppShell({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname() ?? '';
  const router = useRouter();

  // El motor de tutoriales no importa `next/navigation`: recibe aquí la única
  // navegación que necesita. Así un recorrido lanzado desde el Centro puede
  // llevar al usuario a la pantalla que enseña, y el motor sigue siendo
  // probable sin montar un router.
  const tutorialRouter = useMemo(
    () => ({ pathname, push: (route: string) => router.push(route) }),
    [pathname, router],
  );

  return (
    <UnsavedChangesProvider>
      <TutorialProvider>
        <InteractiveTutorialProvider router={tutorialRouter}>
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
                    {/* Va dentro del `key={pathname}` a propósito: si el motor
                        marca la credencial para cambio, el aviso reaparece en
                        cada vista y no se pierde tras la primera navegación. */}
                    <SessionSecurityNotice />
                    <ViewExplainer />
                    {/* Sólo en la pantalla de entrada: ofrecer el recorrido
                        encima del trabajo de alguien enseña a cerrar la ayuda
                        sin leerla. */}
                    <TutorialWelcomePrompt active={pathname === '/platform-health'} />
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
