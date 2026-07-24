import type { ErrorTutorialLink, InteractiveTutorial } from './interactive-types';

/**
 * Catálogo de tutoriales interactivos, data-driven. Los `target` usan selectores
 * estables (ids que el componente ya genera o `data-tutorial-id`), nunca clases
 * de CSS volátiles. El contenido está escrito para alguien que no programa.
 */
export const TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  'artifact-detail': {
    id: 'artifact-detail',
    title: 'Ficha del artefacto',
    intro: 'Cómo leer y gobernar una política de decisión y sus versiones.',
    version: 1,
    steps: [
      {
        id: 'intro',
        title: 'Qué es esta pantalla',
        content:
          'Un artefacto es una política de decisión: el conjunto de reglas que decide, por ejemplo, si se aprueba un crédito. Acá ves su información y todas sus versiones.',
      },
      {
        id: 'summary-tab',
        target: '#artifact-tab-summary',
        title: 'Pestaña Resumen',
        content:
          'Muestra los datos generales (código, tipo, equipo dueño) y la versión que hoy resuelve las decisiones. Es la foto rápida del artefacto.',
      },
      {
        id: 'open-versions',
        target: '#artifact-tab-versions',
        title: 'Abrí las versiones',
        content:
          'Cada cambio a la política crea una versión nueva, sin borrar la anterior. Hacé clic en “Versiones” para ver su historia.',
        tip: 'El tutorial espera a que hagas el clic: así aprendés haciendo, no solo leyendo.',
        requiredAction: 'click',
      },
      {
        id: 'version-graph',
        target: '.version-graph',
        title: 'El árbol de versiones',
        content:
          'Se dibuja como un grafo de git: cada punto es una versión y las líneas muestran de cuál nació. Sirve para entender cómo evolucionó la decisión y comparar.',
        optional: true,
      },
    ],
  },
  'graph-editor': {
    id: 'graph-editor',
    title: 'Editor de grafo',
    intro: 'Cómo diseñar el flujo de una decisión conectando bloques.',
    version: 1,
    steps: [
      {
        id: 'intro',
        title: 'El lienzo de la decisión',
        content:
          'Acá se dibuja, como un diagrama, el camino que sigue una decisión: recibe datos, evalúa condiciones y llega a un resultado (aprobado, rechazado o a revisión).',
      },
      {
        id: 'load',
        target: '[data-tutorial-id="graph-load"]',
        title: 'Cargar una versión',
        content:
          'Primero elegís qué versión del artefacto vas a diseñar. El editor trae sus bloques y conexiones para que los ajustes.',
        optional: true,
      },
      {
        id: 'notes',
        target: '.graph-notes',
        title: 'Documentá el porqué',
        content:
          'Las notas explican, en palabras, por qué existe cada rama y qué supone la decisión. Ayudan a quien revise o herede esta política.',
        optional: true,
      },
    ],
  },
  'error:VALIDATION_ERROR': {
    id: 'error:VALIDATION_ERROR',
    title: 'Corregir un error de validación',
    intro: 'Qué significa el error y cómo dejar los datos correctos.',
    version: 1,
    steps: [
      {
        id: 'what',
        title: 'Qué pasó',
        content:
          'Faltó un dato obligatorio o alguno tiene un formato inválido, así que el sistema no guardó para evitar dejar la decisión a medias. No se rompió nada: solo hay que completar bien.',
      },
      {
        id: 'how',
        title: 'Cómo corregirlo',
        content:
          'Revisá los campos marcados en rojo, completá los obligatorios y respetá el formato indicado (por ejemplo, un código en MAYÚSCULAS o un número). Después volvé a guardar.',
        tip: 'Si un campo pide “código”, no uses espacios ni acentos; usá guiones bajos.',
      },
    ],
  },
};

/** Código de error del backend → tutorial que enseña a corregirlo. */
export const ERROR_TUTORIALS: Readonly<Record<string, ErrorTutorialLink>> = {
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
};

export function tutorialById(id: string): InteractiveTutorial | null {
  return TUTORIALS[id] ?? null;
}

export function errorTutorial(code: string | undefined): ErrorTutorialLink | null {
  return code ? (ERROR_TUTORIALS[code] ?? null) : null;
}
