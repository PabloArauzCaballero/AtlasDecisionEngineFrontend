'use client';

import { GraduationCap, PlayCircle } from 'lucide-react';
import type { StartOptions } from './InteractiveTutorialContext';
import type { TutorialListing } from './interactive-types';
import type { CenterSummary } from './tutorial-center-state';

interface Props {
  summary: CenterSummary;
  /** Recomendados que aún están pendientes. Vacío = no se muestra la fila. */
  recommended: readonly TutorialListing[];
  onStart: (id: string, options?: StartOptions) => void;
}

/**
 * Cabecera del Centro: cuánto llevas y por dónde seguir.
 *
 * El porcentaje se mide sólo sobre los recorridos que el rol del usuario puede
 * hacer, así que el 100 % es alcanzable de verdad; medir contra el catálogo
 * entero dejaría a casi todo el mundo con una barra que nunca se llena.
 */
export function TutorialCenterSummary({ summary, recommended, onStart }: Props) {
  return (
    <section className="tutorial-center-summary" data-tutorial-id="tutorial-center-progress">
      <div className="tutorial-center-progress">
        <div className="tutorial-center-progress-head">
          <GraduationCap size={18} aria-hidden />
          <div>
            <strong>Tu avance</strong>
            <span>
              {summary.completed} de {summary.total} recorridos completados
            </span>
          </div>
          <p className="tutorial-center-percent">{summary.percent}%</p>
        </div>
        <div
          className="tutorial-center-bar"
          role="progressbar"
          aria-valuenow={summary.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance general de tutoriales"
        >
          {/* Sin relleno cuando no hay avance: el `min-width` que hace visible
              un 3 % pintaría también un 0 %, y eso sería mentir. */}
          {summary.percent > 0 ? <span style={{ width: `${summary.percent}%` }} /> : null}
        </div>
        <ul className="tutorial-center-tally">
          <li>
            <strong>{summary.completed}</strong> completados
          </li>
          <li>
            <strong>{summary.inProgress}</strong> en progreso
          </li>
          <li>
            <strong>{summary.pending}</strong> pendientes
          </li>
        </ul>
      </div>

      {recommended.length > 0 ? (
        <div className="tutorial-center-recommended">
          <h2>Empieza por aquí</h2>
          <p>
            Estos recorridos explican lo básico del portal. Si es tu primer día, hazlos en este
            orden.
          </p>
          <ul>
            {recommended.map((listing) => (
              <li key={listing.id}>
                <button type="button" onClick={() => onStart(listing.id, { resume: true })}>
                  <PlayCircle size={15} aria-hidden />
                  <span>
                    <strong>{listing.title}</strong>
                    <small>{listing.estimatedMinutes} min</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
