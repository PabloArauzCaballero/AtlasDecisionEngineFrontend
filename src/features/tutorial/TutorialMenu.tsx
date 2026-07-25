'use client';

import { BookOpen, GraduationCap, Play } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { tutorialForRoute } from './interactive-catalog';
import { resolveTutorial } from './tutorial-content';
import { useInteractiveTutorial } from './useInteractiveTutorial';
import { useTutorial } from './useTutorial';

/**
 * Único punto de entrada a la ayuda de cada pantalla. Ofrece dos modos, con el
 * INTERACTIVO primero (a): "Recorrido guiado" (paso a paso con resaltado) y, si la
 * pantalla también tiene guía de lectura, "Leer la guía" (el panel explicativo, c).
 * Reemplaza los dos botones que antes coexistían (barra superior + título).
 */
export function TutorialMenu() {
  const pathname = usePathname() ?? '';
  const interactive = useInteractiveTutorial();
  const drawer = useTutorial();
  const [open, setOpen] = useState(false);

  const interactiveId = tutorialForRoute(pathname);
  const hasInteractive = Boolean(interactiveId);
  const hasDrawer = Boolean(resolveTutorial(pathname));
  if (!hasInteractive && !hasDrawer) return null;

  const startInteractive = () => {
    setOpen(false);
    if (interactiveId) interactive.start(interactiveId);
  };
  const startDrawer = () => {
    setOpen(false);
    drawer.start();
  };

  // A single available mode acts directly — no menu needed.
  if (hasInteractive !== hasDrawer) {
    return (
      <button
        type="button"
        className="tutorial-button"
        onClick={hasInteractive ? startInteractive : startDrawer}
      >
        <GraduationCap size={15} aria-hidden /> Tutorial
      </button>
    );
  }

  return (
    <span className="tutorial-menu">
      <button
        type="button"
        className="tutorial-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <GraduationCap size={15} aria-hidden /> Tutorial
      </button>
      {open ? (
        <div className="tutorial-menu-pop" role="menu">
          <button type="button" role="menuitem" onClick={startInteractive}>
            <Play size={14} aria-hidden />
            <span>
              <strong>Recorrido guiado</strong>
              <small>Hazlo paso a paso, con resaltado</small>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={startDrawer}>
            <BookOpen size={14} aria-hidden />
            <span>
              <strong>Leer la guía</strong>
              <small>Explicación de esta pantalla</small>
            </span>
          </button>
        </div>
      ) : null}
    </span>
  );
}
