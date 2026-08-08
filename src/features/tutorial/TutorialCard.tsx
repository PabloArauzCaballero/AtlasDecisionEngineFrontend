'use client';

import { CheckCircle2, PlayCircle, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { TUTORIAL_LEVEL_LABELS, type TutorialListing } from './interactive-types';
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

/**
 * Distintivo de estado. Sólo aparece cuando hay ALGO que contar.
 *
 * "Pendiente" no está en la tabla a propósito: es el estado por omisión de casi
 * todo el catálogo, así que marcarlo llenaba la rejilla de insignias que decían
 * lo mismo —y con el mismo icono de "play" que ya lleva el botón de empezar—.
 * Lo que se marca es lo excepcional: lo hecho, lo empezado y lo que cambió.
 */
const BADGE: Partial<Record<TutorialState, { icon: typeof CheckCircle2; tone: string }>> = {
  completed: { icon: CheckCircle2, tone: 'success' },
  'in-progress': { icon: RotateCcw, tone: 'info' },
  outdated: { icon: Sparkles, tone: 'warning' },
};

/**
 * Tarjeta de un tutorial en el Centro.
 *
 * El estado se comunica con icono + palabra, nunca sólo con color: quien no
 * distinga verde de ámbar tiene que poder leerlo igual.
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
  const badge = BADGE[state];
  const BadgeIcon = badge?.icon;
  const blocked = pendingPrerequisites.length > 0 && state === 'pending';
  const repeatable = state !== 'pending';

  return (
    <article className={`tutorial-card tutorial-card-${state}`} data-tutorial-state={state}>
      <div className="tutorial-card-top">
        <h3>{listing.title}</h3>
        {badge && BadgeIcon ? (
          <span className={`tutorial-card-badge tutorial-badge-${badge.tone}`}>
            <BadgeIcon size={13} aria-hidden /> {STATE_LABELS[state]}
          </span>
        ) : null}
      </div>

      <p className="tutorial-card-intro">{listing.intro}</p>

      {/* Una línea de datos con separadores, y no cuatro cápsulas: son
          metadatos de apoyo, no etiquetas que haya que distinguir de un vistazo. */}
      <p className="tutorial-card-meta">
        <span>{listing.estimatedMinutes} min</span>
        <span>{TUTORIAL_LEVEL_LABELS[listing.level]}</span>
        <span>
          {listing.stepCount} {listing.stepCount === 1 ? 'paso' : 'pasos'}
        </span>
        {listing.essential ? <span className="tutorial-card-essential">Troncal</span> : null}
      </p>

      <div className="tutorial-card-notes">
        {state === 'in-progress' ? (
          <p>
            Lo dejaste en el paso {lastStep + 1} de {listing.stepCount}.
          </p>
        ) : null}
        {state === 'outdated' ? (
          <p>Cambió desde que lo hiciste: ahora enseña cosas nuevas.</p>
        ) : null}
        {repeatCount > 0 ? (
          <p>
            Repetido {repeatCount} {repeatCount === 1 ? 'vez' : 'veces'}.
          </p>
        ) : null}
        {/* Sugerencia, no bloqueo: sin candado ni color de alarma. Se puede
            empezar igual, y el botón sigue disponible. */}
        {blocked ? <p>Antes conviene: {pendingPrerequisites.join(', ')}.</p> : null}
      </div>

      <div className="tutorial-card-actions">
        {/* Secundario a propósito. El primario sólido, repetido en las treinta
            tarjetas del catálogo, convertía la rejilla en una hilera de barras
            negras: treinta llamadas a la acción compitiendo entre sí no destacan
            ninguna. El énfasis se reserva para "Empieza por aquí", que sí dice
            por dónde empezar. */}
        <button className="button" type="button" onClick={onStart}>
          <PlayCircle size={14} aria-hidden /> {primaryActionLabel(state)}
        </button>
        {repeatable ? (
          <button
            className="icon-button tutorial-card-restart"
            type="button"
            onClick={onRestart}
            title="Empezar de cero, desde el primer paso"
            aria-label={`Reiniciar ${listing.title}`}
          >
            <RefreshCw size={15} aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
}
