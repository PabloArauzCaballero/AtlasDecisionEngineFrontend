import type { TutorialCategory, TutorialLevel, TutorialListing } from './interactive-types';
import type { TutorialProgress } from './useTutorialProgress';

/** Estado de un tutorial para ESTE usuario, tal y como lo pinta el Centro. */
export type TutorialState = 'pending' | 'in-progress' | 'completed' | 'outdated';

export const STATE_LABELS: Readonly<Record<TutorialState, string>> = {
  pending: 'Pendiente',
  'in-progress': 'En progreso',
  completed: 'Completado',
  outdated: 'Actualizado',
};

/**
 * Estado a partir del progreso guardado.
 *
 * "Actualizado" (`outdated`) es el caso del §7: el usuario lo completó, pero el
 * recorrido se reescribió después. No se le borra el historial ni se le dice que
 * está pendiente —lo hizo—, se le avisa de que ahora enseña otra cosa.
 *
 * Un recorrido ABANDONADO a medias cuenta como "en progreso", no como saltado:
 * lo que el usuario quiere de él es un botón para retomarlo.
 */
export function tutorialState(listing: TutorialListing, entry?: TutorialProgress): TutorialState {
  if (!entry) return 'pending';
  if (entry.status === 'COMPLETED') {
    return entry.version < listing.version ? 'outdated' : 'completed';
  }
  // SKIPPED con avance real es alguien que salió a medias y puede retomar.
  return entry.lastStep > 0 ? 'in-progress' : 'pending';
}

export interface CenterFilters {
  search: string;
  category: TutorialCategory | 'all';
  state: TutorialState | 'all';
  level: TutorialLevel | 'all';
}

export const EMPTY_FILTERS: CenterFilters = {
  search: '',
  category: 'all',
  state: 'all',
  level: 'all',
};

function matchesSearch(listing: TutorialListing, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${listing.title} ${listing.intro}`.toLowerCase().includes(term);
}

export function filterListings(
  listings: readonly TutorialListing[],
  stateOf: (listing: TutorialListing) => TutorialState,
  filters: CenterFilters,
): TutorialListing[] {
  return listings.filter(
    (listing) =>
      matchesSearch(listing, filters.search) &&
      (filters.category === 'all' || listing.category === filters.category) &&
      (filters.level === 'all' || listing.level === filters.level) &&
      (filters.state === 'all' || stateOf(listing) === filters.state),
  );
}

export interface CenterSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  /** Porcentaje 0–100, redondeado. */
  percent: number;
}

/**
 * Resumen sobre lo que ESTE usuario puede ver.
 *
 * Contar el catálogo entero dejaría el porcentaje clavado por debajo del 100 %
 * para cualquiera que no sea administrador: se estaría midiendo contra
 * recorridos que su rol no puede abrir. Un "actualizado" no suma como
 * completado, porque queda algo nuevo por ver.
 */
export function summarize(
  listings: readonly TutorialListing[],
  stateOf: (listing: TutorialListing) => TutorialState,
): CenterSummary {
  let completed = 0;
  let inProgress = 0;
  for (const listing of listings) {
    const state = stateOf(listing);
    if (state === 'completed') completed += 1;
    else if (state === 'in-progress' || state === 'outdated') inProgress += 1;
  }
  const total = listings.length;
  return {
    total,
    completed,
    inProgress,
    pending: total - completed - inProgress,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/** Qué ofrece el botón principal de la tarjeta según el estado. */
export function primaryActionLabel(state: TutorialState): string {
  if (state === 'in-progress') return 'Continuar';
  if (state === 'completed') return 'Repetir';
  if (state === 'outdated') return 'Ver lo nuevo';
  return 'Comenzar';
}
