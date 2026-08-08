import { canAccessPath } from '../../auth/route-access';
import { TUTORIALS } from './interactive-catalog';
import type { TutorialListing, TutorialMeta } from './interactive-types';
import { TUTORIAL_META_LIST as META } from './tutorial-registry.data';

/**
 * Registro del Centro de Tutoriales: convierte las fichas en lo que el Centro lista y
 * decide quién ve cada recorrido.
 *
 * Las fichas viven en `tutorial-registry.data.ts`. Añadir un tutorial es añadir una ficha
 * allí más su definición de pasos en un catálogo: el motor no se toca.
 */
export const TUTORIAL_META: Readonly<Record<string, TutorialMeta>> = Object.fromEntries(
  META.map((meta) => [meta.id, meta]),
);

export function tutorialMeta(id: string): TutorialMeta | null {
  return TUTORIAL_META[id] ?? null;
}

/** Título legible de un tutorial. Cae al id si no existe, para no mentir. */
export function tutorialTitle(id: string): string {
  return TUTORIALS[id]?.title ?? id;
}

/**
 * ¿Puede este usuario ver el tutorial?
 *
 * Un tutorial sin ruta es universal (bienvenida, errores). Uno con ruta hereda
 * exactamente el permiso de esa ruta, de modo que nadie recibe un recorrido
 * sobre una pantalla que su rol no puede abrir.
 */
export function canSeeTutorial(meta: TutorialMeta, roles: readonly string[]): boolean {
  return meta.route ? canAccessPath(meta.route, roles) : true;
}

/** Une metadatos y definición. Devuelve null si el id no tiene pasos cargados. */
function toListing(meta: TutorialMeta): TutorialListing | null {
  const tutorial = TUTORIALS[meta.id];
  if (!tutorial) return null;
  return {
    ...meta,
    title: tutorial.title,
    intro: tutorial.intro,
    version: tutorial.version,
    stepCount: tutorial.steps.length,
  };
}

/** Catálogo completo con metadatos, sin filtrar por rol. Base de las pruebas. */
export function allListings(): TutorialListing[] {
  return META.map(toListing).filter((entry): entry is TutorialListing => entry !== null);
}

/** Lo que el Centro muestra a ESTE usuario: sólo lo que sus roles alcanzan. */
export function listingsForRoles(roles: readonly string[]): TutorialListing[] {
  return allListings().filter((listing) => canSeeTutorial(listing, roles));
}

/**
 * Prerrequisitos que el usuario todavía no ha completado, ya filtrados por rol:
 * exigir un recorrido que su rol ni siquiera puede ver sería un callejón.
 */
export function pendingPrerequisites(
  listing: TutorialListing,
  isCompleted: (id: string) => boolean,
  roles: readonly string[],
): string[] {
  return (listing.prerequisites ?? [])
    .filter((id) => {
      const meta = TUTORIAL_META[id];
      return meta ? canSeeTutorial(meta, roles) : false;
    })
    .filter((id) => !isCompleted(id));
}
