import { ArrowRight } from 'lucide-react';
import type { ReviewStep } from './review-model';

/**
 * El artefacto leído de arriba abajo: cada paso con lo que hace, por qué y a dónde lleva.
 *
 * Es lo que firma quien aprueba. Un grafo dibujado enseña la forma; esto enseña las reglas,
 * con los umbrales y los motivos escritos, en el orden en que un caso los recorre.
 */
export function DecisionSteps({ steps }: { steps: ReviewStep[] }) {
  if (!steps.length) {
    return <div className="empty-state">Esta versión no tiene grafo que leer.</div>;
  }
  return (
    <ol className="analyst-steps">
      {steps.map((step, index) => (
        <li key={step.key} className="analyst-step">
          <div className="analyst-step__head">
            <span className="analyst-step__number">{index + 1}</span>
            <strong>{step.label}</strong>
            <span className="analyst-step__kind">{step.kind}</span>
          </div>
          {step.why.length ? (
            <ul className="analyst-step__why">
              {step.why.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {step.exits.length ? (
            <ul className="analyst-step__exits">
              {step.exits.map((exit) => (
                <li key={`${exit.to}-${exit.when}`}>
                  <span className="analyst-step__when">{exit.when}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                  <span>{exit.to}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="analyst-step__end">Aquí termina el recorrido.</p>
          )}
        </li>
      ))}
    </ol>
  );
}
