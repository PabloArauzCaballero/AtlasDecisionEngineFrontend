import type { ErrorTutorialLink, InteractiveTutorial } from './interactive-types';

/**
 * Catálogo de errores conocidos del backend → explicación comprensible + tutorial.
 * Cada código real (DomainException) se mapea a un texto que dice QUÉ pasó y CÓMO
 * resolverlo, y a un tutorial guiado. Nunca mostramos "Bad Request" a secas.
 */
const step = (id: string, title: string, content: string, tip?: string) => ({
  id,
  title,
  content,
  ...(tip ? { tip } : {}),
});

export const ERROR_TUTORIAL_DEFS: Readonly<Record<string, InteractiveTutorial>> = {
  'error:MISSING_OUTPUT': {
    id: 'error:MISSING_OUTPUT',
    title: 'La decisión no tiene una salida',
    intro: 'Sin una variable de salida, el sistema no puede devolver una conclusión.',
    version: 1,
    steps: [
      step(
        'what',
        '¿Qué pasó?',
        'La versión no declara una variable de SALIDA (o un nodo Resultado no la produce). La salida es la conclusión que devuelve la decisión: “aprobado”, “rechazado”, “revisión”…',
      ),
      step(
        'fix',
        '¿Cómo corregirlo?',
        'En el editor, abre “Contrato global de resultados” (panel Salidas), pulsa “Añadir salida” y elige/crea una (p. ej. decision_outcome). Luego añade un nodo Resultado y asóciale esa salida.',
        'Marca una salida escalar como principal con la estrella: es la conclusión que usa el motor.',
      ),
    ],
  },
  'error:NOT_COMPILED': {
    id: 'error:NOT_COMPILED',
    title: 'La versión no está compilada',
    intro: 'Para ejecutar, simular o probar, la versión debe compilarse primero.',
    version: 1,
    steps: [
      step(
        'what',
        '¿Qué pasó?',
        'Intentaste ejecutar/simular/probar una versión que aún no tiene un artefacto compilado válido. La compilación traduce tu grafo a algo que el motor puede correr.',
      ),
      step(
        'fix',
        '¿Cómo corregirlo?',
        'Abre la versión y usa “Validar / compilar”. Si la validación falla, corrige lo que marque (p. ej. falta salida o nodo terminal) y vuelve a compilar.',
      ),
    ],
  },
  'error:DEPLOY_PERMISSION': {
    id: 'error:DEPLOY_PERMISSION',
    title: 'No puedes desplegar esta versión',
    intro: 'Desplegar exige un rol y respeta la separación de funciones.',
    version: 1,
    steps: [
      step(
        'what',
        '¿Qué pasó?',
        'Desplegar requiere rol Platform Admin y una versión APROBADA. Además, el AUTOR de la versión no puede desplegarla él mismo (control de cuatro ojos).',
      ),
      step(
        'fix',
        '¿Cómo corregirlo?',
        'Pide a un usuario con Platform Admin distinto del autor que la despliegue, y asegúrate de que pasó por Revisiones y quedó Aprobada.',
      ),
    ],
  },
  'error:SCRIPT_NODES': {
    id: 'error:SCRIPT_NODES',
    title: 'Los nodos de código están deshabilitados',
    intro: 'Ejecutar scripts requiere habilitar el runner aislado.',
    version: 1,
    steps: [
      step(
        'what',
        '¿Qué pasó?',
        'La versión usa un nodo de Resultado con código (Python/JS) pero la ejecución de scripts está apagada por seguridad (SCRIPT_NODES_ENABLED=false).',
      ),
      step(
        'fix',
        '¿Cómo corregirlo?',
        'Pide a la plataforma habilitar el runner aislado, o reemplaza el nodo de código por condiciones/expresiones visuales si no necesitas un script.',
      ),
    ],
  },
  'error:VERSION_STATE': {
    id: 'error:VERSION_STATE',
    title: 'El estado de esta versión no admite esa operación',
    intro:
      'Cada versión recorre un camino —Diseño, Validada, Compilada, Aprobada, Desplegada— y en cada punto sólo cabe lo siguiente.',
    version: 2,
    steps: [
      step(
        'what',
        '¿Qué pasó?',
        'Pediste validar o compilar una versión cuyo estado no lo admite. El motor sólo compila lo que está VALIDADA: una que ya está COMPILADA no se recompila (el resultado sería idéntico) y una DESPLEGADA queda congelada para que la decisión sea auditable.',
      ),
      step(
        'fix',
        '¿Cómo corregirlo?',
        'Mira el recorrido en el asistente de Validar y Compilar: marca el punto exacto en el que está la versión y qué corresponde hacer. Si está compilada, el paso siguiente es enviarla a revisión, no volver a compilar; si está desplegada o retirada, los cambios van en una versión nueva.',
        'Cada versión es una foto inmutable: para cambiar algo, tomas una foto nueva — pero sólo cuando la anterior ya salió a producción.',
      ),
    ],
  },
  'error:NO_DEPLOYMENT': {
    id: 'error:NO_DEPLOYMENT',
    title: 'Ese algoritmo no está desplegado en ese ambiente',
    intro:
      'Simular y ejecutar usan el artefacto compilado que está DESPLEGADO en el ambiente; compilar no basta.',
    version: 1,
    steps: [
      step(
        'what',
        '¿Qué pasó?',
        'Pediste una decisión (o una simulación) de un algoritmo en un ambiente donde no tiene un despliegue activo. El motor no elige una versión por su cuenta: ejecuta exactamente la que alguien desplegó ahí, y por eso no hay nada que ejecutar.',
      ),
      step(
        'fix',
        '¿Cómo corregirlo?',
        'O eliges un ambiente donde sí esté desplegado —el simulador marca cuáles—, o creas el despliegue en Despliegues. Para desplegar, la versión tiene que estar compilada y aprobada.',
        'Compilada = lista para ejecutarse. Desplegada = puesta a ejecutar en un ambiente concreto.',
      ),
    ],
  },
  'error:REFERENCE': {
    id: 'error:REFERENCE',
    title: 'Problema con un algoritmo referenciado',
    intro: 'Un árbol interno no se puede resolver como está.',
    version: 1,
    steps: [
      step(
        'what',
        '¿Qué pasó?',
        'La decisión referencia otro algoritmo (árbol interno) que no está disponible: no existe, su versión no está compilada, o se excedió la profundidad máxima de anidamiento (para evitar recursión infinita).',
      ),
      step(
        'fix',
        '¿Cómo corregirlo?',
        'Verifica que el algoritmo hijo y su versión existan y estén compilados, y evita cadenas demasiado profundas o circulares (A llama a B que llama a A).',
      ),
    ],
  },
};

const link = (tutorialId: string, title: string, description: string): ErrorTutorialLink => ({
  tutorialId,
  title,
  description,
});

/** Código de error del backend → tutorial + texto comprensible. */
export const ERROR_LINKS: Readonly<Record<string, ErrorTutorialLink>> = {
  UNDECLARED_OUTPUT: link(
    'error:MISSING_OUTPUT',
    'Falta declarar una salida',
    'Te guío a crearla.',
  ),
  OUTPUT_TYPE_INVALID: link(
    'error:MISSING_OUTPUT',
    'El tipo de la salida no es válido',
    'Revisa el contrato de salidas.',
  ),
  /*
   * Llegaba a la pantalla tal cual lo escribe el motor: «No active deployment
   * for AFFORDABILITY_CONTRACT_DEMO in TEST». Es exacto y es inútil para quien
   * no sabe que simular exige un despliegue activo, además de estar en inglés
   * en un portal en español.
   */
  ACTIVE_DEPLOYMENT_NOT_FOUND: link(
    'error:NO_DEPLOYMENT',
    'Ese algoritmo no está desplegado en ese ambiente',
    'Elige un ambiente donde sí lo esté, o créale un despliegue.',
  ),
  COMPILED_ARTIFACT_NOT_FOUND: link(
    'error:NOT_COMPILED',
    'La versión no está compilada',
    'Te muestro cómo validarla y compilarla.',
  ),
  VERSION_NOT_COMPILED: link(
    'error:NOT_COMPILED',
    'La versión no está compilada',
    'Compílala antes de ejecutarla.',
  ),
  /*
   * Estas dos NO afirman por qué. El motor rechaza por el estado concreto —una
   * versión ya compilada, una en revisión, una desplegada— y el mensaje que
   * trae lo dice; escribir aquí «está desplegada o retirada» convertía un
   * rechazo correcto en un diagnóstico falso, y mandaba a crear una versión
   * nueva a quien sólo tenía que aprobar la que ya tenía compilada.
   */
  VERSION_NOT_VALIDATABLE: link(
    'error:VERSION_STATE',
    'El estado de esta versión no admite validarla',
    'El asistente indica en qué punto está y qué corresponde hacer.',
  ),
  VERSION_NOT_COMPILABLE: link(
    'error:VERSION_STATE',
    'El estado de esta versión no admite compilarla',
    'Sólo se compila lo que está validado. El asistente dice cuál es el paso siguiente.',
  ),
  VALIDATION_REQUIRED: link(
    'error:NOT_COMPILED',
    'El grafo cambió y ya no es válido',
    'Vuelve a validarlo y corrige lo señalado antes de compilar.',
  ),
  VERSION_NOT_APPROVED: link(
    'error:DEPLOY_PERMISSION',
    'La versión no está aprobada',
    'Debe pasar por Revisiones primero.',
  ),
  SEPARATION_OF_DUTIES_VIOLATION: link(
    'error:DEPLOY_PERMISSION',
    'No puedes desplegar tu propia versión',
    'Necesitas otro usuario con permiso.',
  ),
  SIMULATION_PROD_FORBIDDEN: link(
    'error:DEPLOY_PERMISSION',
    'No se simula en producción',
    'Elige un ambiente sandbox o test.',
  ),
  SCRIPT_NODES_DISABLED: link(
    'error:SCRIPT_NODES',
    'Los nodos de código están apagados',
    'Te explico cómo proceder.',
  ),
  SCRIPT_EXECUTION_FAILED: link(
    'error:SCRIPT_NODES',
    'El script del nodo falló',
    'Revisa el código del nodo de resultado.',
  ),
  SCRIPT_INVALID_OUTPUT: link(
    'error:SCRIPT_NODES',
    'El script no devolvió un objeto',
    'Debe asignar un objeto a result.',
  ),
  NESTED_TREE_MAX_DEPTH_EXCEEDED: link(
    'error:REFERENCE',
    'Demasiados algoritmos anidados',
    'Reduce la profundidad de referencias.',
  ),
  CHILD_VERSION_NOT_COMPILED: link(
    'error:REFERENCE',
    'El algoritmo referenciado no está compilado',
    'Compila la versión hija.',
  ),
  REFERENCE_NOT_FOUND: link(
    'error:REFERENCE',
    'No se encontró la referencia',
    'Revisa el árbol interno enlazado.',
  ),
  NESTED_EXECUTION_FAILED: link(
    'error:REFERENCE',
    'Falló un algoritmo referenciado',
    'Revisa el árbol interno.',
  ),
};
