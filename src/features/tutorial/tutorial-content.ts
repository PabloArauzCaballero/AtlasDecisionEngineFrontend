import { engineTutorials } from './tutorial-content-engine';
import { governTutorials } from './tutorial-content-govern';
import { labTutorials } from './tutorial-content-lab';
import type { Tutorial, TutorialRegistry } from './tutorial.types';

/** Every tool's tutorial, keyed by route path. */
export const tutorials: TutorialRegistry = {
  ...engineTutorials,
  ...labTutorials,
  ...governTutorials,
};

/** Resolves the tutorial for a route: exact match, else the longest path prefix. */
export function resolveTutorial(pathname: string): Tutorial | null {
  if (tutorials[pathname]) return tutorials[pathname];
  const key = Object.keys(tutorials)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? tutorials[key] : null;
}
