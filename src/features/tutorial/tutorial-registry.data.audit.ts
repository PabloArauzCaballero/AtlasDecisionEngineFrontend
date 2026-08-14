import type { TutorialMeta } from './interactive-types';

/**
 * Fichas de los recorridos de la sección «Auditoría» y de trazabilidad.
 *
 * Viven aparte de `tutorial-registry.data.ts` por el tope de 299 líneas del repositorio, y
 * el corte va por aquí porque es un bloque que se lee entero: las tres pantallas de
 * medición sólo se entienden en orden —hay datos con los que medir, el modelo se degrada,
 * bajo qué condiciones se le deja operar— y esa cadena está en los prerrequisitos.
 *
 * Cuidado al tocar los prerrequisitos: la prueba del registro exige que el previo no pida
 * MÁS permisos que el recorrido que lo pide. `decision-quality` puede exigirse desde
 * cualquiera de estas pantallas porque su ruta la abren los cinco roles; al revés no,
 * porque `/model-monitoring` deja fuera a `OPERATIONS` a propósito.
 */
export const AUDIT_META_LIST: readonly TutorialMeta[] = [
  {
    id: 'executions',
    category: 'auditoria',
    level: 'basico',
    route: '/executions',
    estimatedMinutes: 5,
  },
  {
    id: 'execution-detail',
    category: 'auditoria',
    level: 'intermedio',
    route: '/executions',
    estimatedMinutes: 5,
    prerequisites: ['executions'],
  },
  {
    id: 'audit-events',
    category: 'auditoria',
    level: 'basico',
    route: '/audit-events',
    estimatedMinutes: 4,
    prerequisites: ['executions'],
  },
  {
    // Primero de las tres pantallas de medición: responde si hay datos con los que
    // medir, que es la pregunta anterior a las otras dos.
    id: 'decision-quality',
    category: 'auditoria',
    level: 'intermedio',
    route: '/decision-quality',
    estimatedMinutes: 7,
  },
  {
    id: 'model-monitoring',
    category: 'auditoria',
    level: 'avanzado',
    route: '/model-monitoring',
    estimatedMinutes: 6,
    prerequisites: ['decision-quality'],
  },
  {
    id: 'risk-governance',
    category: 'auditoria',
    level: 'avanzado',
    route: '/risk-governance',
    estimatedMinutes: 8,
    prerequisites: ['decision-quality'],
  },
  {
    id: 'data-subject-requests',
    category: 'auditoria',
    level: 'intermedio',
    route: '/data-subject-requests',
    estimatedMinutes: 5,
  },
  {
    id: 'objective-detail',
    category: 'auditoria',
    level: 'intermedio',
    route: '/objectives',
    estimatedMinutes: 5,
  },
  {
    id: 'coverage-matrix',
    category: 'auditoria',
    level: 'intermedio',
    route: '/coverage-matrix',
    estimatedMinutes: 4,
    prerequisites: ['objective-detail'],
  },
];
