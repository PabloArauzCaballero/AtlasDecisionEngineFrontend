'use client';

import { useState, type PropsWithChildren } from 'react';
import { TutorialProvider } from '../../features/tutorial/TutorialProvider';
import { NextSidebar } from './NextSidebar';
import { NextTopbar } from './NextTopbar';

export function NextAppShell({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <TutorialProvider>
      <div className="app-shell">
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
            {children}
          </main>
        </div>
      </div>
    </TutorialProvider>
  );
}
