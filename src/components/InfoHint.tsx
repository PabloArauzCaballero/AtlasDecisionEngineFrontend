'use client';

import { HelpCircle } from 'lucide-react';
import { useId, type FocusEvent } from 'react';
import { createPortal } from 'react-dom';
import { useHintBubble } from '../hooks/useHintBubble';

interface InfoHintProps {
  /** Plain-language explanation shown on hover/focus. */
  text: string;
  /** Accessible label for the trigger; defaults to a generic phrasing. */
  label?: string;
}

/** `:focus-visible` decide si el foco vino del teclado; jsdom puede no soportarlo. */
function focusCameFromKeyboard(trigger: HTMLElement): boolean {
  try {
    return trigger.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * Small accessible "?" affordance that reveals a plain-language explanation on
 * hover or keyboard focus. Aimed at non-technical analysts: it demystifies
 * domain jargon (outcome, SLA, cobertura…) without cluttering the layout.
 *
 * El globo se monta en `document.body` y `useHintBubble` lo coloca con
 * coordenadas fijas — dentro del disparador quedaba tapado por barras y
 * cabeceras pegajosas y recortado por contenedores con `overflow`. Sigue
 * siempre montado (opacidad 0): `aria-describedby` lo encuentra por id esté
 * donde esté.
 */
export function InfoHint({ text, label = 'Más información' }: InfoHintProps) {
  const id = useId();
  const { wrapRef, bubbleRef, open, placement, show, hide } = useHintBubble();
  return (
    <span className="info-hint" ref={wrapRef} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        className="info-hint-trigger"
        aria-label={label}
        aria-describedby={id}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          if (focusCameFromKeyboard(event.currentTarget)) show();
        }}
        onBlur={hide}
      >
        <HelpCircle size={14} aria-hidden="true" />
      </button>
      {typeof document === 'undefined'
        ? null
        : createPortal(
            <span
              role="tooltip"
              id={id}
              className="info-hint-bubble"
              ref={bubbleRef}
              data-open={open || undefined}
              data-placement={placement}
            >
              {text}
            </span>,
            document.body,
          )}
    </span>
  );
}
