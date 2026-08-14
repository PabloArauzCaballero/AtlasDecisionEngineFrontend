import type { TutorialMeta } from './interactive-types';
import { AUDIT_META_LIST } from './tutorial-registry.data.audit';

/**
 * Fichas del Centro de Tutoriales: qué recorridos hay, en qué categoría, con qué nivel y
 * qué conviene haber hecho antes.
 *
 * Vive separado de `tutorial-registry.ts` —que es la lógica de filtrado y de permisos—
 * porque son dos cosas que cambian por motivos distintos: esta lista crece cada vez que se
 * escribe un recorrido nuevo, y las funciones de al lado no se tocan desde hace meses.
 * Juntas superaban el límite de 299 líneas del repositorio.
 *
 * `route` cumple dos funciones y por eso no se puede omitir en los recorridos de pantalla:
 * es a dónde navega «Comenzar» y —vía `canAccessPath()`— de dónde sale el permiso. Los
 * tutoriales sin `route` (errores, bienvenida) son universales.
 */
export const TUTORIAL_META_LIST: readonly TutorialMeta[] = [
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
    // Se hace DESPUÉS del mapa de herramientas: éste las usa para dejar un
    // algoritmo terminado, así que da por sabido dónde está cada control.
    id: 'graph-editor-algoritmo',
    category: 'diseno',
    level: 'intermedio',
    route: '/graph-editor',
    estimatedMinutes: 12,
    prerequisites: ['graph-editor'],
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

  // — Diseño (§5–§6): piezas reutilizables que un algoritmo consume.
  {
    id: 'calculated-fields',
    category: 'diseno',
    level: 'intermedio',
    route: '/calculated-fields',
    estimatedMinutes: 6,
    prerequisites: ['variables'],
  },
  {
    id: 'libraries',
    category: 'diseno',
    level: 'avanzado',
    route: '/libraries',
    estimatedMinutes: 3,
    prerequisites: ['calculated-fields'],
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
  {
    id: 'qa-lab',
    category: 'calidad',
    level: 'avanzado',
    route: '/qa-lab',
    estimatedMinutes: 6,
    prerequisites: ['test-cases'],
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
  {
    id: 'workers',
    category: 'operacion',
    level: 'intermedio',
    route: '/workers',
    estimatedMinutes: 4,
  },

  // — Auditoría y trazabilidad: en `tutorial-registry.data.audit.ts`, que se lee entero.
  ...AUDIT_META_LIST,

  // — Errores: se disparan solos desde una notificación, y también se pueden
  //   repasar en frío desde el Centro. Sin ruta: aplican donde ocurra el error.
  { id: 'error:VALIDATION_ERROR', category: 'errores', level: 'basico', estimatedMinutes: 2 },
  { id: 'error:MISSING_OUTPUT', category: 'errores', level: 'intermedio', estimatedMinutes: 3 },
  { id: 'error:NOT_COMPILED', category: 'errores', level: 'intermedio', estimatedMinutes: 2 },
  { id: 'error:DEPLOY_PERMISSION', category: 'errores', level: 'basico', estimatedMinutes: 2 },
  { id: 'error:SCRIPT_NODES', category: 'errores', level: 'avanzado', estimatedMinutes: 3 },
  { id: 'error:VERSION_STATE', category: 'errores', level: 'intermedio', estimatedMinutes: 2 },
  { id: 'error:NO_DEPLOYMENT', category: 'errores', level: 'basico', estimatedMinutes: 2 },
  { id: 'error:REFERENCE', category: 'errores', level: 'intermedio', estimatedMinutes: 3 },
];
