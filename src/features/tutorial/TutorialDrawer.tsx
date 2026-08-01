'use client';

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Compass,
  GraduationCap,
  Lightbulb,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { CONCEPTS, conceptTutorials } from './tutorial-content-concepts';
import type { Tutorial } from './tutorial.types';

interface TutorialDrawerProps {
  tutorial: Tutorial;
  onClose: () => void;
  /** Launches the global interactive walkthrough (spotlight tour), if available. */
  onStartTour?: () => void;
}

/**
 * In-page tutorial drawer. Slides in from the right and walks the steps of the
 * active tutorial (prev/next, dots, keyboard ← / → / Esc). It doubles as a mini
 * docs browser: the "Conceptos clave" chips swap the body to a business-level
 * concept explainer (for analysts), and "Volver" returns to the tool tutorial.
 */
export function TutorialDrawer({ tutorial, onClose, onStartTour }: TutorialDrawerProps) {
  const drawer = useRef<HTMLElement>(null);
  useDialogFocus(drawer);
  const [active, setActive] = useState<Tutorial>(tutorial);
  const [index, setIndex] = useState(0);
  const isConcept = active !== tutorial;
  const total = active.steps.length;
  const step = active.steps[index];
  const atFirst = index === 0;
  const atLast = index === total - 1;

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))),
    [total],
  );
  const show = (next: Tutorial) => {
    setActive(next);
    setIndex(0);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  return (
    <div
      className="tutorial-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawer}
        className="tutorial-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <header className="tutorial-head">
          <span className="tutorial-head-icon" aria-hidden="true">
            <GraduationCap size={20} />
          </span>
          <div>
            <p>{active.eyebrow}</p>
            <h2 id="tutorial-title">{active.title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Cerrar tutorial"
            onClick={onClose}
          >
            <X />
          </button>
        </header>

        {isConcept ? (
          <button type="button" className="tutorial-back" onClick={() => show(tutorial)}>
            <ArrowLeft size={14} /> Volver a {tutorial.title}
          </button>
        ) : null}

        <p className="tutorial-intro">{active.intro}</p>

        {!isConcept && onStartTour ? (
          <button type="button" className="tutorial-tour-cta" onClick={onStartTour}>
            <Compass size={16} aria-hidden="true" />
            <span>Iniciar recorrido guiado interactivo de la plataforma</span>
          </button>
        ) : null}

        <div className="tutorial-dots" role="tablist" aria-label="Pasos del tutorial">
          {active.steps.map((item, i) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Paso ${i + 1}: ${item.title}`}
              className={i === index ? 'active' : i < index ? 'done' : ''}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <div key={`${active.title}-${index}`} className="tutorial-step">
          <span className="tutorial-step-number">{index + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
          {step.tip ? (
            <div className="tutorial-tip">
              <Lightbulb size={15} aria-hidden="true" />
              <span>{step.tip}</span>
            </div>
          ) : null}
        </div>

        <div className="tutorial-concepts">
          <p>Conceptos clave para analistas</p>
          <div className="tutorial-concept-chips">
            {CONCEPTS.map((concept) => (
              <button
                key={concept.key}
                type="button"
                className={active === conceptTutorials[concept.key] ? 'active' : ''}
                onClick={() => show(conceptTutorials[concept.key])}
              >
                {concept.title}
              </button>
            ))}
          </div>
        </div>

        <footer className="tutorial-actions">
          <span className="tutorial-counter">
            Paso {index + 1} de {total}
          </span>
          <div className="tutorial-buttons">
            <button className="button" type="button" disabled={atFirst} onClick={() => go(-1)}>
              <ChevronLeft size={15} /> Anterior
            </button>
            {atLast ? (
              <button className="button button-primary" type="button" onClick={onClose}>
                Entendido
              </button>
            ) : (
              <button className="button button-primary" type="button" onClick={() => go(1)}>
                Siguiente <ChevronRight size={15} />
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}
