'use client';

import { ArrowLeft, ArrowRight, MousePointerClick, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InteractiveTutorial } from './interactive-types';
import { useTutorialTarget } from './useTutorialTarget';

const PAD = 8;

interface Props {
  tutorial: InteractiveTutorial;
  stepIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onExit: () => void;
}

/**
 * Overlay interactivo: oscurece la pantalla, resalta el elemento del paso actual
 * y muestra una tarjeta con la explicación. Cuando el paso pide una acción
 * (`requiredAction`), NO ofrece "Siguiente": escucha la acción real sobre el
 * elemento resaltado y avanza recién cuando el usuario la hace.
 */
export function InteractiveTutorialOverlay({
  tutorial,
  stepIndex,
  onNext,
  onPrevious,
  onExit,
}: Props) {
  const step = tutorial.steps[stepIndex];
  const rect = useTutorialTarget(step.target);
  const [actionDone, setActionDone] = useState(false);

  useEffect(() => {
    setActionDone(false);
    if (step.requiredAction !== 'click' || !step.target) return;
    const element = document.querySelector(step.target);
    if (!element) return;
    const handler = () => {
      setActionDone(true);
      onNext();
    };
    element.addEventListener('click', handler, { once: true });
    return () => element.removeEventListener('click', handler);
  }, [step, onNext]);

  const waitingForAction = step.requiredAction === 'click' && !actionDone;
  const isLast = stepIndex === tutorial.steps.length - 1;

  const tooltipStyle = rect
    ? {
        top: Math.min(window.innerHeight - 240, Math.max(12, rect.bottom + PAD + 12)),
        left: Math.min(window.innerWidth - 360, Math.max(12, rect.left)),
      }
    : undefined;

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="tutorial-spotlight"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="tutorial-scrim" />
      )}
      <div
        className={rect ? 'tutorial-tooltip' : 'tutorial-tooltip tutorial-tooltip-centered'}
        style={tooltipStyle}
      >
        <button
          className="icon-button tutorial-close"
          type="button"
          onClick={onExit}
          aria-label="Salir del tutorial"
        >
          <X size={16} />
        </button>
        <p className="tutorial-progress">
          Paso {stepIndex + 1} de {tutorial.steps.length}
        </p>
        <h3>{step.title}</h3>
        <p>{step.content}</p>
        {step.tip ? <p className="tutorial-tip">{step.tip}</p> : null}
        <div className="tutorial-actions">
          <button className="button" type="button" onClick={onPrevious} disabled={stepIndex === 0}>
            <ArrowLeft size={14} /> Atrás
          </button>
          {waitingForAction ? (
            <span className="tutorial-wait">
              <MousePointerClick size={14} /> Hacé la acción resaltada para seguir…
            </span>
          ) : (
            <button className="button button-primary" type="button" onClick={onNext}>
              {isLast ? 'Finalizar' : 'Siguiente'} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
