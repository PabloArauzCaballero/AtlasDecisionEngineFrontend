import { DETAIL_TUTORIALS } from './interactive-catalog-detail';
import { EDITOR_TUTORIALS } from './interactive-catalog-editor';
import { ERROR_LINKS, ERROR_TUTORIAL_DEFS } from './interactive-catalog-errors';
import { LAB_TUTORIALS } from './interactive-catalog-lab';
import { ONBOARDING_TUTORIALS } from './interactive-catalog-onboarding';
import { OPS_TUTORIALS } from './interactive-catalog-ops';
import { TOOL_TUTORIALS } from './interactive-catalog-tools';
import { WORKER_TUTORIALS } from './interactive-catalog-workers';
import type { ErrorTutorialLink, InteractiveTutorial } from './interactive-types';

/** Catálogo completo: entrada + base + herramientas (por ruta) + errores. */
export const TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  ...ONBOARDING_TUTORIALS,
  ...DETAIL_TUTORIALS,
  ...EDITOR_TUTORIALS,
  ...TOOL_TUTORIALS,
  ...OPS_TUTORIALS,
  ...LAB_TUTORIALS,
  ...WORKER_TUTORIALS,
  ...ERROR_TUTORIAL_DEFS,
};

/**
 * Código de error del backend (o `kind` de ApiError) → tutorial que enseña a
 * corregirlo. Se acepta el `kind` (p. ej. `validation`) para cubrir cualquier
 * error de esa familia aunque no traiga un código específico.
 */
export const ERROR_TUTORIALS: Readonly<Record<string, ErrorTutorialLink>> = {
  ...ERROR_LINKS,
  VALIDATION_ERROR: {
    tutorialId: 'error:VALIDATION_ERROR',
    title: 'Faltan datos o hay un formato inválido',
    description: 'Te guío paso a paso a corregirlo.',
  },
  INVALID_API_PATH: {
    tutorialId: 'error:VALIDATION_ERROR',
    title: 'La solicitud no era válida',
    description: 'Te muestro cómo dejar los datos correctos.',
  },
  validation: {
    tutorialId: 'error:VALIDATION_ERROR',
    title: 'Hay datos que corregir antes de guardar',
    description: 'Abre el tutorial guiado para dejarlos correctos.',
  },
};

export function tutorialById(id: string): InteractiveTutorial | null {
  return TUTORIALS[id] ?? null;
}

/** Ruta exacta → id de tutorial. Las páginas de detalle usan PATTERN_TUTORIAL. */
const ROUTE_TUTORIAL: Readonly<Record<string, string>> = {
  '/platform-health': 'welcome',
  '/tutorials': 'tutorial-center',
  '/variables': 'variables',
  '/reason-codes': 'reason-codes',
  '/artifacts': 'artifacts',
  '/algorithms': 'algorithms',
  '/test-suites': 'test-suites',
  '/test-cases': 'test-cases',
  // La ruta real es `/graph-coverage`; `/coverage` no existe en el portal, así
  // que este tutorial nunca llegaba a ofrecerse en su propia pantalla.
  '/graph-coverage': 'coverage',
  '/deployments': 'deployments',
  '/environments': 'environments',
  '/simulator': 'simulator',
  '/live-execution': 'live-execution',
  '/code-import': 'code-import',
  '/reviews': 'reviews',
  // §5–§10: las cuatro pantallas que llegaron sin recorrido y son las que menos
  // se adivinan mirándolas.
  '/calculated-fields': 'calculated-fields',
  '/libraries': 'libraries',
  '/qa-lab': 'qa-lab',
  '/coverage-matrix': 'coverage-matrix',
  '/workers': 'workers',
};

/** Detail/editor routes (dynamic) → their interactive tutorial id. */
const PATTERN_TUTORIAL: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/graph-editor\/?$/, 'graph-editor'],
  [/^\/artifacts\/[^/]+\/?$/, 'artifact-detail'],
  [/^\/executions\/[^/]+\/?$/, 'execution-detail'],
  [/^\/manual-reviews\/[^/]+\/?$/, 'manual-review'],
  [/^\/objectives\/[^/]+\/?$/, 'objective-detail'],
];

/** Resolves the interactive tutorial id for a route (exact tool routes + patterns). */
export function tutorialForRoute(pathname: string): string | null {
  if (ROUTE_TUTORIAL[pathname]) return ROUTE_TUTORIAL[pathname];
  for (const [pattern, id] of PATTERN_TUTORIAL) if (pattern.test(pathname)) return id;
  return null;
}

/**
 * Recorridos ADICIONALES de una pantalla, después del principal.
 *
 * Una vista con dos preguntas distintas necesita dos recorridos: el editor de
 * grafo tiene el mapa de herramientas («¿qué hace este botón?») y la
 * construcción guiada («¿y cómo hago un algoritmo?»). Sin esta tabla, el botón
 * «Tutorial» de la pantalla sólo alcanzaba al primero y el segundo quedaba
 * enterrado en el Centro de Tutoriales, que es justo donde no está quien tiene
 * la duda.
 *
 * Es una tabla explícita a propósito: derivarla de `route` en el registro
 * arrastraría a los recorridos de ficha a las pantallas de listado.
 */
const ROUTE_EXTRA_TUTORIALS: Readonly<Record<string, readonly string[]>> = {
  '/graph-editor': ['graph-editor-algoritmo'],
};

/** Todos los recorridos interactivos de una ruta, el principal primero. */
export function tutorialsForRoute(pathname: string): string[] {
  const primary = tutorialForRoute(pathname);
  if (!primary) return [];
  return [primary, ...(ROUTE_EXTRA_TUTORIALS[pathname] ?? [])].filter((id) => id in TUTORIALS);
}

export function errorTutorial(code: string | undefined): ErrorTutorialLink | null {
  return code ? (ERROR_TUTORIALS[code] ?? null) : null;
}
