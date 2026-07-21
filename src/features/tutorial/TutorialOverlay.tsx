import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useTutorial } from './useTutorial';
import { useTutorialTarget } from './useTutorialTarget';
import type { TutorialStep } from './tutorial-steps';

interface TutorialOverlayProps {
  step: TutorialStep;
}

const SPOTLIGHT_PADDING = 8;

/**
 * Renders a scrim with a spotlight cutout around the current step's target
 * element (via a box-shadow "hole"), plus a tooltip with the step content and
 * next/prev/exit controls. Falls back to a centered, un-anchored tooltip when
 * the step has no target or it hasn't mounted yet. Transitions use plain CSS so
 * the existing global `prefers-reduced-motion` rule (auth-feedback.css) already
 * neutralizes them for users who need that.
 */
export function TutorialOverlay({ step }: TutorialOverlayProps) {
  const { stepIndex, totalSteps, next, previous, exit } = useTutorial();
  const rect = useTutorialTarget(step.targetSelector);

  const tooltipStyle = rect
    ? {
        top: Math.min(window.innerHeight - 220, Math.max(12, rect.bottom + SPOTLIGHT_PADDING + 12)),
        left: Math.min(window.innerWidth - 340, Math.max(12, rect.left)),
      }
    : undefined;

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="tutorial-spotlight"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
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
          onClick={exit}
          aria-label="Salir del tutorial"
        >
          <X size={16} />
        </button>
        <p className="tutorial-progress">
          Paso {stepIndex + 1} de {totalSteps}
        </p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tutorial-actions">
          <button className="button" type="button" onClick={previous} disabled={stepIndex === 0}>
            <ArrowLeft size={14} /> Atrás
          </button>
          <button className="button button-primary" type="button" onClick={next}>
            {stepIndex === totalSteps - 1 ? 'Finalizar' : 'Siguiente'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
