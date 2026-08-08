import { inRecord, openRecordStep } from './interactive-step-helpers';
import type { InteractiveTutorial } from './interactive-types';

/**
 * Catálogo de tutoriales interactivos, data-driven. Los `target` usan selectores
 * estables (ids que el componente ya genera o `data-tutorial-id`), nunca clases
 * de CSS volátiles. El contenido está escrito para alguien que no programa.
 */
export const DETAIL_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  'artifact-detail': {
    id: 'artifact-detail',
    title: 'Ficha del artefacto',
    intro: 'Cómo leer y gobernar una política de decisión y sus versiones.',
    version: 2,
    steps: [
      openRecordStep('/artifacts', 'un artefacto'),
      inRecord({
        id: 'intro',
        title: 'Qué es esta pantalla',
        content:
          'Un artefacto es una política de decisión: el conjunto de reglas que decide, por ejemplo, si se aprueba un crédito. Acá ves su información y todas sus versiones.',
      }),
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
        title: 'Abre las versiones',
        content:
          'Cada cambio a la política crea una versión nueva y conserva la anterior: nada se sobrescribe. Pulsa la pestaña “Versiones” para ver esa historia completa.',
        tip: 'Este paso espera tu clic de verdad; si prefieres seguir leyendo, usa “Saltar este paso”.',
        requiredAction: 'click',
        // Opcional a propósito: la pestaña sólo existe con un artefacto cargado.
        // Sin esto, abrir el tutorial desde otra pantalla dejaba el recorrido
        // esperando un clic sobre algo que no estaba.
        optional: true,
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
  'execution-detail': {
    id: 'execution-detail',
    title: 'Auditar una ejecución',
    intro: 'Cómo leer qué entró, qué decidió el sistema y por qué camino pasó.',
    version: 2,
    steps: [
      openRecordStep('/executions', 'una ejecución'),
      inRecord({
        id: 'intro',
        title: 'Qué es una ejecución',
        content:
          'Es el registro inmutable de una decisión que ya ocurrió: los datos que entraron, el resultado y cada paso que siguió. Sirve para auditar y explicar por qué se resolvió así.',
      }),
      {
        id: 'summary',
        target: '.execution-summary',
        title: 'El resultado de un vistazo',
        content:
          'Acá ves el estado, el resultado final (aprobado, rechazado o a revisión) y cuánto tardó. Es la conclusión; abajo está el detalle que la respalda.',
      },
      {
        id: 'input',
        target: '[aria-label="Input Payload"]',
        title: 'Qué datos entraron',
        content:
          'La petición original. Cambiá entre Tabla (atributo→valor, legible) y JSON (crudo) con las pestañas del panel: la misma información, dos formas de leerla.',
        tip: 'Con la vista Gráfico, una traza se dibuja como fases; los datos normales se muestran como árbol.',
      },
      {
        id: 'output',
        target: '[aria-label="Output Snapshot"]',
        title: 'Qué decidió el sistema',
        content:
          'La respuesta que devolvió el motor. Comparala con lo que entró para entender qué reglas se activaron.',
        optional: true,
      },
      {
        id: 'timeline',
        target: '.execution-detail-grid aside',
        title: 'El camino que siguió',
        content:
          'La línea de tiempo lista cada nodo que evaluó la decisión, en orden y con su duración. Es el “paso a paso” que explica el resultado.',
        optional: true,
      },
    ],
  },
  'manual-review': {
    id: 'manual-review',
    title: 'Resolver un caso manual',
    intro: 'Qué mira un revisor y cómo cerrar el caso con una decisión trazable.',
    version: 2,
    steps: [
      openRecordStep('/manual-reviews', 'un caso'),
      inRecord({
        id: 'intro',
        title: 'Por qué llega un caso acá',
        content:
          'Cuando la decisión automática no alcanza (monto alto, señal de riesgo, regla que exige ojo humano), el caso entra a esta cola para que una persona resuelva.',
      }),
      {
        id: 'input',
        target: '[aria-label="Input Snapshot"]',
        title: 'La evidencia del caso',
        content:
          'Es la foto de los datos con los que se ejecutó la decisión. Revisala en Tabla o JSON antes de resolver: tu decisión debe apoyarse en esto.',
      },
      {
        id: 'resolve',
        target: '[data-tutorial-id="review-resolution"]',
        title: 'Cierra con una decisión y un porqué',
        content:
          'Elige aprobar, rechazar o escalar, y deja un comentario. El comentario es obligatorio: queda en la auditoría y explica en el futuro por qué se resolvió así.',
        tip: 'Sin comentario el botón queda deshabilitado: la trazabilidad no es opcional.',
      },
    ],
  },
  'objective-detail': {
    id: 'objective-detail',
    title: 'Leer un objetivo de negocio',
    intro: 'Cómo conecta una meta de negocio con las políticas y su evidencia.',
    version: 2,
    steps: [
      openRecordStep('/objectives', 'un objetivo'),
      inRecord({
        id: 'intro',
        title: 'Qué es un objetivo',
        content:
          'Es una meta de negocio medible (por ejemplo, “aprobar el 80% en menos de 2 s”). Todo lo demás en la pantalla existe para mostrar si se está cumpliendo y con qué respaldo.',
      }),
      {
        id: 'metrics',
        target: '.target-metrics',
        title: 'Actual vs objetivo',
        content:
          'Compara el valor de hoy con la meta. Es el pulso del objetivo: de un vistazo sabés si vas bien o hay que actuar.',
      },
      {
        id: 'policies',
        target: '.policy-list',
        title: 'Las políticas que lo respaldan',
        content:
          'Las reglas regulatorias asociadas a este objetivo. Cada una explica por qué la meta se define así y qué hay que cumplir.',
      },
      {
        id: 'matrix',
        target: '[data-tutorial-id="objective-matrix"]',
        title: 'La evidencia de implementación',
        content:
          'Muestra qué políticas ya están cubiertas por artefactos y pruebas, y dónde hay huecos (GAP). Es la prueba de que el objetivo está realmente implementado, no solo declarado.',
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
          'Revisa los campos marcados en rojo, completa los obligatorios y respeta el formato indicado (por ejemplo, un código en MAYÚSCULAS o un número). Después vuelve a guardar.',
        tip: 'Si un campo pide “código”, no uses espacios ni acentos: separa las palabras con guiones bajos.',
      },
    ],
  },
};
