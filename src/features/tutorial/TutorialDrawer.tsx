'use client';

import { ChevronLeft, ChevronRight, GraduationCap, Lightbulb, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Tutorial } from './tutorial.types';

interface TutorialDrawerProps {
  tutorial: Tutorial;
  onClose: () => void;
}

/**
 * In-page tutorial drawer. Slides in from the right, walks the steps with
 * prev/next + progress dots, and replays a soft transition on each step (the
 * `key` on the step body forces a remount so the entrance animation fires).
 * Keyboard: ← / → move, Esc closes.
 */
export function TutorialDrawer({ tutorial, onClose }: TutorialDrawerProps) {
  const [index, setIndex] = useState(0);
  const total = tutorial.steps.length;
  const step = tutorial.steps[index];
  const atFirst = index === 0;
  const atLast = index === total - 1;

  const go = useCallback((delta: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))), [total]);

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
            <p>{tutorial.eyebrow}</p>
            <h2 id="tutorial-title">{tutorial.title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Cerrar tutorial" onClick={onClose}>
            <X />
          </button>
        </header>

        <p className="tutorial-intro">{tutorial.intro}</p>

        <div className="tutorial-dots" role="tablist" aria-label="Pasos del tutorial">
          {tutorial.steps.map((item, i) => (
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

        <div key={index} className="tutorial-step">
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
