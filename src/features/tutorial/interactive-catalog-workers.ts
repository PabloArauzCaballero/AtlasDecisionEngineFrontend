import type { InteractiveTutorial } from './interactive-types';

/**
 * Recorridos de los workers de procesamiento y de la matriz de cobertura.
 *
 * Los dos comparten el mismo problema: se ven como pantallas de resultados y no dicen qué
 * decisión sostienen. Un worker parece «un lector de PDF» hasta que se entiende que lo que
 * extrae ENTRA en un algoritmo; la matriz parece un informe hasta que se ve que cada hueco
 * es un objetivo de negocio sin nada que demuestre que se cumple.
 */

export const WORKER_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  workers: {
    id: 'workers',
    title: 'Workers: convertir un documento en datos',
    intro:
      'Un algoritmo decide sobre números y categorías, no sobre PDFs. Los workers son los procesos que convierten lo que llega —un extracto bancario, un texto libre— en las variables que el contrato del algoritmo espera.',
    version: 1,
    steps: [
      {
        id: 'what',
        route: '/workers',
        target: '[data-tutorial-id="workers-switch"]',
        title: 'Qué hace un worker en la cadena',
        content:
          'Cada pestaña es un worker distinto. El de extractos lee un PDF y saca movimientos, saldos e institución; el de análisis semántico clasifica texto en categorías del catálogo. Ninguno decide nada: producen los datos con los que después decide un algoritmo.',
        tip: 'Un nodo del grafo puede llamar a un worker. Cuando lo hace, la calidad de la decisión no puede ser mejor que la calidad de esta extracción.',
      },
      {
        id: 'panel',
        target: '[data-tutorial-id="workers-dashboard"]',
        title: 'El panel dice si se puede confiar',
        content:
          'Resume las corridas recientes, cuánto tardan y cuántas terminan con advertencias o con error. Una tasa alta de advertencias no es ruido: significa que el worker está entregando datos incompletos, y una decisión tomada sobre datos incompletos es una decisión mal tomada.',
        optional: true,
      },
      {
        id: 'console',
        target: '[data-tutorial-id="workers-console"]',
        title: 'Probar con un documento real',
        content:
          'La consola procesa un documento delante de ti y enseña lo que el worker entendió, campo por campo. Es la forma de comprobar un formato nuevo —otro banco, otra maquetación— antes de dejar que alimente decisiones de verdad.',
        tip: 'Si el resultado trae advertencias, léelas antes que el resumen: dicen exactamente qué parte del documento no se pudo interpretar.',
        optional: true,
      },
    ],
  },

  'coverage-matrix': {
    id: 'coverage-matrix',
    title: 'Matriz de cobertura: qué queda sin demostrar',
    intro:
      'Cruza los objetivos de negocio con las políticas, los artefactos que las implementan y las pruebas que lo demuestran. Sirve para responder, con evidencia, si lo que la organización dice que hace está realmente implementado y probado.',
    version: 1,
    steps: [
      {
        id: 'summary',
        route: '/coverage-matrix',
        target: '[data-tutorial-id="coverage-matrix-summary"]',
        title: 'Los tres números',
        content:
          'La cobertura es el porcentaje de cruces con evidencia completa. Los enlaces de evidencia son los controles que sí tienen algo que los respalde. Los huecos son lo contrario: un objetivo declarado del que no hay nada que demuestre que se cumple.',
        tip: 'Un hueco no significa que la regla no exista; significa que no hay forma de demostrarlo ante una auditoría, que a efectos prácticos es lo mismo.',
      },
      {
        id: 'grid',
        target: '[data-tutorial-id="coverage-matrix-grid"]',
        title: 'Leer la rejilla',
        content:
          'Cada fila es un objetivo de negocio y cada columna una política. Completo significa que hay artefacto y prueba; parcial, que existe la regla pero nadie la ha probado; hueco, que no hay ninguna de las dos. La raya es una política que pertenece a OTRO objetivo: no se cuenta ni como hueco ni en el porcentaje. Se lee por filas: un objetivo con toda su fila en parcial es la deuda más urgente.',
        optional: true,
      },
      {
        id: 'export',
        title: 'Exportar para la revisión',
        content:
          '«Exportar» descarga la matriz tal como se ve, con la fecha de la sincronización. Es el documento que se lleva a una revisión de cumplimiento: la foto de qué estaba demostrado ese día, no una consulta que devuelve otra cosa la semana siguiente.',
        optional: true,
      },
    ],
  },
};
