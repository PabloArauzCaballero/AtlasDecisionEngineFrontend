import { canAccessPath } from '../../auth/route-access';
import { TUTORIALS } from './interactive-catalog';
import type { TutorialListing, TutorialMeta } from './interactive-types';

/**
 * Catálogo de metadatos del Centro de Tutoriales.
 *
 * Se mantiene APARTE de los pasos a propósito: los archivos de pasos ya rozan el
 * límite de 299 líneas del repositorio, y el Centro sólo necesita listar y
 * filtrar, no cargar el recorrido entero. Añadir un tutorial es añadir una
 * entrada aquí más su definición de pasos: el motor no se toca.
 *
 * `route` cumple dos funciones y por eso no se puede omitir en los recorridos de
 * pantalla: es a dónde navega "Comenzar" y —vía `canAccessPath()`— de dónde sale
 * el permiso. Los tutoriales sin `route` (errores, bienvenida) son universales.
 */
const META: readonly TutorialMeta[] = [
  // — Introducción: lo primero que ve alguien que nunca abrió el portal.
  {
    id: 'welcome',
    category: 'introduccion',
    level: 'basico',
    estimatedMinutes: 3,
    recommended: true,
    essential: true,
  },
  {
    id: 'navigation',
    category: 'introduccion',
    level: 'basico',
    estimatedMinutes: 4,
    prerequisites: ['welcome'],
    recommended: true,
    essential: true,
  },
  {
    id: 'session',
    category: 'introduccion',
    level: 'basico',
    estimatedMinutes: 2,
    prerequisites: ['welcome'],
    recommended: true,
  },
  {
    id: 'tutorial-center',
    category: 'introduccion',
    level: 'basico',
    route: '/tutorials',
    estimatedMinutes: 2,
    recommended: true,
  },

  // — Diseño: el catálogo y la autoría del algoritmo.
  {
    id: 'variables',
    category: 'diseno',
    level: 'basico',
    route: '/variables',
    estimatedMinutes: 4,
  },
  {
    id: 'reason-codes',
    category: 'diseno',
    level: 'basico',
    route: '/reason-codes',
    estimatedMinutes: 3,
  },
  {
    id: 'artifacts',
    category: 'diseno',
    level: 'basico',
    route: '/artifacts',
    estimatedMinutes: 4,
    essential: true,
  },
  {
    id: 'artifact-detail',
    category: 'diseno',
    level: 'intermedio',
    route: '/artifacts',
    estimatedMinutes: 5,
    prerequisites: ['artifacts'],
  },
  {
    id: 'algorithms',
    category: 'diseno',
    level: 'intermedio',
    route: '/algorithms',
    estimatedMinutes: 4,
    prerequisites: ['artifacts'],
  },
  {
    id: 'graph-editor',
    category: 'diseno',
    level: 'intermedio',
    route: '/graph-editor',
    estimatedMinutes: 8,
    prerequisites: ['variables', 'artifacts'],
    essential: true,
  },
  {
    id: 'code-import',
    category: 'diseno',
    level: 'avanzado',
    route: '/code-import',
    estimatedMinutes: 7,
    prerequisites: ['variables', 'graph-editor'],
  },

  // — Calidad.
  {
    id: 'test-suites',
    category: 'calidad',
    level: 'basico',
    route: '/test-suites',
    estimatedMinutes: 4,
  },
  {
    id: 'test-cases',
    category: 'calidad',
    level: 'basico',
    route: '/test-cases',
    estimatedMinutes: 4,
    prerequisites: ['test-suites'],
  },
  {
    id: 'coverage',
    category: 'calidad',
    level: 'intermedio',
    route: '/graph-coverage',
    estimatedMinutes: 4,
    prerequisites: ['test-suites'],
  },

  // — Gobierno.
  {
    id: 'reviews',
    category: 'gobierno',
    level: 'intermedio',
    route: '/reviews',
    estimatedMinutes: 5,
  },
  {
    id: 'environments',
    category: 'gobierno',
    level: 'intermedio',
    route: '/environments',
    estimatedMinutes: 3,
  },
  {
    id: 'deployments',
    category: 'gobierno',
    level: 'intermedio',
    route: '/deployments',
    estimatedMinutes: 4,
    prerequisites: ['environments'],
  },

  // — Operación.
  {
    id: 'simulator',
    category: 'operacion',
    level: 'basico',
    route: '/simulator',
    estimatedMinutes: 5,
    recommended: true,
    essential: true,
  },
  {
    id: 'live-execution',
    category: 'operacion',
    level: 'intermedio',
    route: '/live-execution',
    estimatedMinutes: 4,
    prerequisites: ['simulator'],
  },
  {
    id: 'manual-review',
    category: 'operacion',
    level: 'intermedio',
    route: '/manual-reviews',
    estimatedMinutes: 5,
  },

  // — Auditoría y trazabilidad.
  {
    id: 'execution-detail',
    category: 'auditoria',
    level: 'intermedio',
    route: '/executions',
    estimatedMinutes: 5,
  },
  {
    id: 'objective-detail',
    category: 'auditoria',
    level: 'intermedio',
    route: '/objectives',
    estimatedMinutes: 5,
  },

  // — Errores: se disparan solos desde una notificación, y también se pueden
  //   repasar en frío desde el Centro. Sin ruta: aplican donde ocurra el error.
  { id: 'error:VALIDATION_ERROR', category: 'errores', level: 'basico', estimatedMinutes: 2 },
  { id: 'error:MISSING_OUTPUT', category: 'errores', level: 'intermedio', estimatedMinutes: 3 },
  { id: 'error:NOT_COMPILED', category: 'errores', level: 'intermedio', estimatedMinutes: 2 },
  { id: 'error:DEPLOY_PERMISSION', category: 'errores', level: 'basico', estimatedMinutes: 2 },
  { id: 'error:SCRIPT_NODES', category: 'errores', level: 'avanzado', estimatedMinutes: 3 },
  { id: 'error:VERSION_STATE', category: 'errores', level: 'intermedio', estimatedMinutes: 2 },
  { id: 'error:REFERENCE', category: 'errores', level: 'intermedio', estimatedMinutes: 3 },
];

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
