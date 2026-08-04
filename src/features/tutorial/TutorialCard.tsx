'use client';

import { CheckCircle2, Clock, Lock, PlayCircle, RefreshCw, Sparkles } from 'lucide-react';
import {
  TUTORIAL_LEVEL_LABELS,
  TUTORIAL_CATEGORY_LABELS,
  type TutorialListing,
} from './interactive-types';
import { primaryActionLabel, STATE_LABELS, type TutorialState } from './tutorial-center-state';

interface Props {
  listing: TutorialListing;
  state: TutorialState;
  /** Paso alcanzado, para poder decir por dónde se retoma. */
  lastStep: number;
  repeatCount: number;
  /** Títulos de los recorridos previos que aún no ha completado. */
  pendingPrerequisites: readonly string[];
  onStart: () => void;
  onRestart: () => void;
}

/** Icono de estado. Nunca va solo: siempre acompaña a la etiqueta de texto. */
const STATE_ICON: Record<TutorialState, typeof CheckCircle2> = {
  pending: PlayCircle,
  'in-progress': Clock,
  completed: CheckCircle2,
  outdated: Sparkles,
};

/**
 * Tarjeta de un tutorial en el Centro.
 *
 * El estado se comunica con icono + palabra + posición, nunca sólo con color:
 * un daltónico tiene que poder distinguir "completado" de "pendiente".
 */
export function TutorialCard({
  listing,
  state,
  lastStep,
  repeatCount,
  pendingPrerequisites,
  onStart,
  onRestart,
}: Props) {
  const StateIcon = STATE_ICON[state];
  const blocked = pendingPrerequisites.length > 0 && state === 'pending';

  return (
    <article className={`tutorial-card tutorial-card-${state}`} data-tutorial-state={state}>
      <header>
        <span className="tutorial-card-category">{TUTORIAL_CATEGORY_LABELS[listing.category]}</span>
        <span className={`tutorial-card-state tutorial-state-${state}`}>
          <StateIcon size={14} aria-hidden /> {STATE_LABELS[state]}
        </span>
      </header>
      <h3>{listing.title}</h3>
      <p className="tutorial-card-intro">{listing.intro}</p>

      <ul className="tutorial-card-facts">
        <li>
          <Clock size={13} aria-hidden /> {listing.estimatedMinutes} min
        </li>
        <li>{TUTORIAL_LEVEL_LABELS[listing.level]}</li>
        <li>
          {listing.stepCount} {listing.stepCount === 1 ? 'paso' : 'pasos'}
        </li>
        {listing.essential ? <li className="tutorial-card-essential">Recorrido troncal</li> : null}
      </ul>

      {state === 'in-progress' ? (
        <p className="tutorial-card-note">
          Lo dejaste en el paso {lastStep + 1} de {listing.stepCount}.
        </p>
      ) : null}
      {state === 'outdated' ? (
        <p className="tutorial-card-note">
          Este recorrido cambió desde que lo hiciste: ahora enseña cosas nuevas.
        </p>
      ) : null}
      {repeatCount > 0 ? (
        <p className="tutorial-card-note">
          Lo has repetido {repeatCount} {repeatCount === 1 ? 'vez' : 'veces'}.
        </p>
      ) : null}
      {blocked ? (
        <p className="tutorial-card-note tutorial-card-prereq">
          <Lock size={13} aria-hidden /> Conviene hacer antes: {pendingPrerequisites.join(', ')}.
        </p>
      ) : null}

      <div className="tutorial-card-actions">
        <button className="button button-primary" type="button" onClick={onStart}>
          <PlayCircle size={14} aria-hidden /> {primaryActionLabel(state)}
        </button>
        {state === 'in-progress' || state === 'completed' || state === 'outdated' ? (
          <button
            className="button"
            type="button"
            onClick={onRestart}
            title="Empezar de cero, desde el primer paso"
          >
            <RefreshCw size={14} aria-hidden /> Reiniciar
          </button>
        ) : null}
      </div>
    </article>
  );
}
