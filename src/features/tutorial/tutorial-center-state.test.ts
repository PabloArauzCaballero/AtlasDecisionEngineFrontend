import { describe, expect, it } from 'vitest';
import type { TutorialListing } from './interactive-types';
import {
  EMPTY_FILTERS,
  filterListings,
  primaryActionLabel,
  summarize,
  tutorialState,
} from './tutorial-center-state';
import type { TutorialProgress } from './useTutorialProgress';

function listing(overrides: Partial<TutorialListing> = {}): TutorialListing {
  return {
    id: 'demo',
    category: 'diseno',
    level: 'basico',
    estimatedMinutes: 4,
    title: 'Editor de grafo',
    intro: 'Diseñar el flujo de una decisión.',
    version: 2,
    stepCount: 5,
    ...overrides,
  };
}

function entry(overrides: Partial<TutorialProgress> = {}): TutorialProgress {
  return {
    tutorialId: 'demo',
    status: 'STARTED',
    lastStep: 0,
    version: 2,
    autoShow: true,
    ...overrides,
  };
}

describe('estado de un tutorial', () => {
  it('sin progreso está pendiente', () => {
    expect(tutorialState(listing(), undefined)).toBe('pending');
  });

  it('completado en la versión vigente está completado', () => {
    expect(tutorialState(listing(), entry({ status: 'COMPLETED', version: 2 }))).toBe('completed');
  });

  it('completado en una versión anterior queda como "actualizado", no como pendiente', () => {
    // El usuario SÍ lo hizo: decirle que está pendiente borraría ese hecho.
    expect(tutorialState(listing({ version: 3 }), entry({ status: 'COMPLETED', version: 2 }))).toBe(
      'outdated',
    );
  });

  it('abandonado a medias cuenta como en progreso, para poder retomarlo', () => {
    expect(tutorialState(listing(), entry({ status: 'SKIPPED', lastStep: 3 }))).toBe('in-progress');
  });

  it('saltado sin haber avanzado nada sigue pendiente', () => {
    expect(tutorialState(listing(), entry({ status: 'SKIPPED', lastStep: 0 }))).toBe('pending');
  });
});

describe('acción principal', () => {
  it('cada estado ofrece el verbo que corresponde', () => {
    expect(primaryActionLabel('pending')).toBe('Comenzar');
    expect(primaryActionLabel('in-progress')).toBe('Continuar');
    expect(primaryActionLabel('completed')).toBe('Repetir');
    expect(primaryActionLabel('outdated')).toBe('Ver lo nuevo');
  });
});

describe('filtros', () => {
  const items = [
    listing({ id: 'a', title: 'Editor de grafo', category: 'diseno', level: 'intermedio' }),
    listing({ id: 'b', title: 'Simulador', category: 'operacion', level: 'basico' }),
    listing({ id: 'c', title: 'Revisiones', category: 'gobierno', level: 'intermedio' }),
  ];
  const allPending = () => 'pending' as const;

  it('sin filtros devuelve todo', () => {
    expect(filterListings(items, allPending, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('busca en título y descripción, sin distinguir mayúsculas', () => {
    expect(filterListings(items, allPending, { ...EMPTY_FILTERS, search: 'GRAFO' })).toHaveLength(
      1,
    );
    expect(
      filterListings(items, allPending, { ...EMPTY_FILTERS, search: 'decisión' }),
    ).toHaveLength(3);
  });

  it('los filtros se combinan entre sí', () => {
    const result = filterListings(items, allPending, {
      ...EMPTY_FILTERS,
      category: 'diseno',
      level: 'intermedio',
    });
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('filtrar por estado usa el estado real de cada uno', () => {
    const stateOf = (item: TutorialListing) =>
      item.id === 'b' ? ('completed' as const) : ('pending' as const);
    const result = filterListings(items, stateOf, { ...EMPTY_FILTERS, state: 'completed' });
    expect(result.map((item) => item.id)).toEqual(['b']);
  });

  it('una búsqueda de sólo espacios no esconde nada', () => {
    expect(filterListings(items, allPending, { ...EMPTY_FILTERS, search: '   ' })).toHaveLength(3);
  });
});

describe('resumen de avance', () => {
  const items = [listing({ id: 'a' }), listing({ id: 'b' }), listing({ id: 'c' })];

  it('cuenta completados, en progreso y pendientes sin solaparlos', () => {
    const stateOf = (item: TutorialListing) =>
      item.id === 'a'
        ? ('completed' as const)
        : item.id === 'b'
          ? ('in-progress' as const)
          : ('pending' as const);
    const summary = summarize(items, stateOf);

    expect(summary).toMatchObject({ total: 3, completed: 1, inProgress: 1, pending: 1 });
    expect(summary.completed + summary.inProgress + summary.pending).toBe(summary.total);
  });

  it('un catálogo vacío da 0 % y no NaN', () => {
    expect(summarize([], () => 'pending')).toMatchObject({ total: 0, percent: 0 });
  });

  it('un tutorial "actualizado" no cuenta como completado: queda algo por ver', () => {
    const summary = summarize([listing()], () => 'outdated');
    expect(summary.completed).toBe(0);
    expect(summary.inProgress).toBe(1);
    expect(summary.percent).toBe(0);
  });

  it('todo completado llega al 100 %', () => {
    expect(summarize(items, () => 'completed').percent).toBe(100);
  });
});
