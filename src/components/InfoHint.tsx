import { HelpCircle } from 'lucide-react';
import { useId } from 'react';

interface InfoHintProps {
  /** Plain-language explanation shown on hover/focus. */
  text: string;
  /** Accessible label for the trigger; defaults to a generic phrasing. */
  label?: string;
}

/**
 * Small accessible "?" affordance that reveals a plain-language explanation on
 * hover or keyboard focus. Aimed at non-technical analysts: it demystifies
 * domain jargon (outcome, SLA, cobertura…) without cluttering the layout.
 */
export function InfoHint({ text, label = 'Más información' }: InfoHintProps) {
  const id = useId();
  return (
    <span className="info-hint">
      <button type="button" className="info-hint-trigger" aria-label={label} aria-describedby={id}>
        <HelpCircle size={14} aria-hidden="true" />
      </button>
      <span role="tooltip" id={id} className="info-hint-bubble">
        {text}
      </span>
    </span>
  );
}
