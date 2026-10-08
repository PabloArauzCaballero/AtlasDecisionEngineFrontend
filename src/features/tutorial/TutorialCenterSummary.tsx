'use client';

import { ArrowRight, Clock3, PlayCircle } from 'lucide-react';
import type { StartOptions } from './InteractiveTutorialContext';
import type { TutorialListing } from './interactive-types';
import type { CenterSummary } from './tutorial-center-state';

interface Props {
  summary: CenterSummary;
  /** Recomendados que aún están pendientes. Vacío = no se muestra la ruta. */
  recommended: readonly TutorialListing[];
  onStart: (id: string, options?: StartOptions) => void;
}

/** Radio del anillo en unidades del `viewBox` (48×48). */
const RADIO = 20;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * Cabecera del Centro: cuánto llevas y por dónde seguir.
 *
 * El porcentaje se mide sólo sobre los recorridos que el rol del usuario puede
 * hacer, así que el 100 % es alcanzable de verdad; medir contra el catálogo
 * entero dejaría a casi todo el mundo con un anillo que nunca se cierra.
 */
export function TutorialCenterSummary({ summary, recommended, onStart }: Props) {
  const minutos = recommended.reduce((suma, item) => suma + item.estimatedMinutes, 0);
  const primero = recommended[0];

  return (
    <section
      className={`tutorial-hero${recommended.length > 0 ? '' : ' tutorial-hero-solo'}`}
      data-tutorial-id="tutorial-center-progress"
    >
      <div className="tutorial-hero-progress">
        <div
          className="tutorial-ring"
          role="progressbar"
          aria-valuenow={summary.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance general de tutoriales"
        >
          <svg viewBox="0 0 48 48" aria-hidden>
            <circle className="tutorial-ring-track" cx="24" cy="24" r={RADIO} />
            {/* Sin trazo cuando no hay avance: el remate redondo pintaría un punto
                en un 0 %, y eso sería mentir. */}
            {summary.percent > 0 ? (
              <circle
                className="tutorial-ring-fill"
                cx="24"
                cy="24"
                r={RADIO}
                strokeDasharray={CIRCUNFERENCIA}
                strokeDashoffset={CIRCUNFERENCIA * (1 - summary.percent / 100)}
              />
            ) : null}
          </svg>
          <p className="tutorial-center-percent">{summary.percent}%</p>
        </div>

        <div className="tutorial-hero-copy">
          <h2>Tu avance</h2>
          <p>
            {summary.completed} de {summary.total} recorridos completados
          </p>
          <ul className="tutorial-center-tally">
            <li className="tutorial-tally-done">
              <strong>{summary.completed}</strong> completados
            </li>
            <li className="tutorial-tally-progress">
              <strong>{summary.inProgress}</strong> en progreso
            </li>
            <li className="tutorial-tally-pending">
              <strong>{summary.pending}</strong> pendientes
            </li>
          </ul>
        </div>
      </div>

      {primero ? (
        <div className="tutorial-hero-route">
          <div className="tutorial-hero-route-head">
            <div>
              <h2>Empieza por aquí</h2>
              <p>
                Lo básico del portal, en este orden · {recommended.length} recorridos · {minutos}{' '}
                min
              </p>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => onStart(primero.id, { resume: true })}
            >
              <PlayCircle size={15} aria-hidden /> Empezar la ruta
            </button>
          </div>
          {/* Lista ORDENADA: el número no es decoración, dice en qué orden hacerlos. */}
          <ol className="tutorial-route">
            {recommended.map((listing, indice) => (
              <li key={listing.id}>
                <button type="button" onClick={() => onStart(listing.id, { resume: true })}>
                  <span className="tutorial-route-step" aria-hidden>
                    {indice + 1}
                  </span>
                  <span className="tutorial-route-text">
                    <strong>{listing.title}</strong>
                    <small>
                      <Clock3 size={12} aria-hidden /> {listing.estimatedMinutes} min
                    </small>
                  </span>
                  <ArrowRight size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
