'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useAuth } from '../auth/useAuth';
import {
  TUTORIAL_CATEGORY_LABELS,
  type TutorialListing,
} from '../features/tutorial/interactive-types';
import { TutorialCard } from '../features/tutorial/TutorialCard';
import { TutorialCenterFilters } from '../features/tutorial/TutorialCenterFilters';
import {
  EMPTY_FILTERS,
  filterListings,
  summarize,
  tutorialState,
  type CenterFilters,
} from '../features/tutorial/tutorial-center-state';
import { TutorialCenterSummary } from '../features/tutorial/TutorialCenterSummary';
import {
  listingsForRoles,
  pendingPrerequisites,
  tutorialTitle,
} from '../features/tutorial/tutorial-registry';
import { useInteractiveTutorial } from '../features/tutorial/useInteractiveTutorial';
import { useTutorialProgress } from '../features/tutorial/useTutorialProgress';

/** Agrupa por módulo conservando el orden del catálogo dentro de cada grupo. */
function groupByCategory(listings: readonly TutorialListing[]) {
  const groups = new Map<TutorialListing['category'], TutorialListing[]>();
  for (const listing of listings) {
    const bucket = groups.get(listing.category) ?? [];
    bucket.push(listing);
    groups.set(listing.category, bucket);
  }
  return [...groups.entries()];
}

/**
 * Centro de Tutoriales: el catálogo completo de recorridos que ESTE usuario
 * puede hacer, con su avance y el botón para empezar, continuar o repetir.
 *
 * Sólo lista; el recorrido lo ejecuta el motor sobre la interfaz real. Al pulsar
 * "Comenzar", el proveedor navega a la pantalla del tutorial y toma el mando.
 */
export function TutorialCenterPage() {
  const { user } = useAuth();
  const roles = useMemo(
    () => [...(user?.roles ?? []), ...(user?.legacyRoles ?? [])],
    [user?.roles, user?.legacyRoles],
  );
  const { progress, isCompleted } = useTutorialProgress();
  const { start } = useInteractiveTutorial();
  const [filters, setFilters] = useState<CenterFilters>(EMPTY_FILTERS);

  const listings = useMemo(() => listingsForRoles(roles), [roles]);
  const stateOf = useMemo(
    () => (listing: TutorialListing) => tutorialState(listing, progress[listing.id]),
    [progress],
  );

  const summary = useMemo(() => summarize(listings, stateOf), [listings, stateOf]);
  const visible = useMemo(
    () => filterListings(listings, stateOf, filters),
    [listings, stateOf, filters],
  );
  const recommended = useMemo(
    () => listings.filter((item) => item.recommended && stateOf(item) === 'pending'),
    [listings, stateOf],
  );

  return (
    <>
      <PageHeader
        eyebrow="Aprendizaje"
        title="Centro de Tutoriales"
        description="Recorridos guiados sobre la interfaz real del portal. Empieza por los recomendados o retoma lo que dejaste a medias."
        hint="Cada tutorial se ejecuta sobre las pantallas de verdad: te lleva a la vista, resalta el elemento y te dice qué hacer. Puedes salir en cualquier momento y continuar después."
      />

      <TutorialCenterSummary summary={summary} recommended={recommended} onStart={start} />

      <Panel title="Todos los tutoriales" meta={`${listings.length} disponibles para tu rol`}>
        <TutorialCenterFilters
          filters={filters}
          onChange={setFilters}
          resultCount={visible.length}
        />

        {visible.length === 0 ? (
          <EmptyState
            illustration="empty"
            title="Ningún tutorial coincide"
            description="Ajusta el buscador o los filtros para volver a ver el catálogo. Recuerda que sólo se listan los recorridos que tu rol puede hacer."
            actions={
              <button className="button" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
                Limpiar filtros
              </button>
            }
          />
        ) : (
          <div data-tutorial-id="tutorial-center-list">
            {groupByCategory(visible).map(([category, items]) => (
              <section className="tutorial-center-group" key={category}>
                <h2>{TUTORIAL_CATEGORY_LABELS[category]}</h2>
                <div className="tutorial-card-grid">
                  {items.map((listing) => {
                    const entry = progress[listing.id];
                    return (
                      <TutorialCard
                        key={listing.id}
                        listing={listing}
                        state={stateOf(listing)}
                        lastStep={entry?.lastStep ?? 0}
                        repeatCount={entry?.repeatCount ?? 0}
                        pendingPrerequisites={pendingPrerequisites(listing, isCompleted, roles).map(
                          tutorialTitle,
                        )}
                        onStart={() => start(listing.id, { resume: true })}
                        // `repeat` ya persiste el reinicio dentro del motor:
                        // llamar aquí también a `restart` contaría la repetición
                        // dos veces.
                        onRestart={() => start(listing.id, { repeat: true })}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
