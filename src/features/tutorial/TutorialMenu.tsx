'use client';

import { BookOpen, GraduationCap, Play } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useContext, useState } from 'react';
import { tutorialById, tutorialsForRoute } from './interactive-catalog';
import { InteractiveTutorialContext } from './InteractiveTutorialContext';
import { resolveTutorial } from './tutorial-content';
import { TutorialContext } from './TutorialContext';

/**
 * Único punto de entrada a la ayuda de cada pantalla. Ofrece dos modos, con el
 * INTERACTIVO primero (a): "Recorrido guiado" (paso a paso con resaltado) y, si la
 * pantalla también tiene guía de lectura, "Leer la guía" (el panel explicativo, c).
 * Reemplaza los dos botones que antes coexistían (barra superior + título).
 */
export function TutorialMenu() {
  const pathname = usePathname() ?? '';
  // Read the contexts nullably: a page rendered without the tutorial providers
  // (e.g. an isolated unit test of that page) must not crash — the button just
  // won't have anything to start. Availability is route-based, not context-based.
  const interactive = useContext(InteractiveTutorialContext);
  const drawer = useContext(TutorialContext);
  const [open, setOpen] = useState(false);

  // Una pantalla puede tener más de un recorrido: el editor de grafo enseña sus
  // herramientas en uno y a construir un algoritmo en otro.
  const interactiveIds = tutorialsForRoute(pathname);
  const hasDrawer = Boolean(resolveTutorial(pathname));
  if (!interactiveIds.length && !hasDrawer) return null;

  const startInteractive = (id: string) => {
    setOpen(false);
    interactive?.start(id);
  };
  const startDrawer = () => {
    setOpen(false);
    drawer?.start();
  };

  // Una sola opción actúa directamente: un menú de un elemento es un clic de más.
  const total = interactiveIds.length + (hasDrawer ? 1 : 0);
  if (total === 1) {
    const only = interactiveIds[0];
    return (
      <button
        type="button"
        className="tutorial-button"
        data-tutorial-id="tutorial-menu"
        onClick={only ? () => startInteractive(only) : startDrawer}
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
        data-tutorial-id="tutorial-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <GraduationCap size={15} aria-hidden /> Tutorial
      </button>
      {open ? (
        <div className="tutorial-menu-pop" role="menu">
          {interactiveIds.map((id, index) => {
            const tutorial = tutorialById(id);
            return (
              <button key={id} type="button" role="menuitem" onClick={() => startInteractive(id)}>
                <Play size={14} aria-hidden />
                <span>
                  {/* El primero conserva su rótulo genérico: es el recorrido de
                      la pantalla y así se llama en el resto del portal. */}
                  <strong>{index === 0 ? 'Recorrido guiado' : (tutorial?.title ?? id)}</strong>
                  <small>
                    {index === 0
                      ? 'Hazlo paso a paso, con resaltado'
                      : (tutorial?.intro ?? 'Recorrido paso a paso')}
                  </small>
                </span>
              </button>
            );
          })}
          {hasDrawer ? (
            <button type="button" role="menuitem" onClick={startDrawer}>
              <BookOpen size={14} aria-hidden />
              <span>
                <strong>Leer la guía</strong>
                <small>Explicación de esta pantalla</small>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
