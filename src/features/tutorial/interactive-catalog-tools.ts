import type { InteractiveTutorial } from './interactive-types';

/**
 * Tutoriales interactivos de las herramientas/listados (los que usan PageHeader).
 * Se resuelven por ruta (ROUTE_TUTORIAL) y se muestran con un botón "Tutorial"
 * global en el encabezado, así CADA pantalla tiene su guía. Texto para no técnicos.
 */
const t = (
  id: string,
  title: string,
  intro: string,
  steps: InteractiveTutorial['steps'],
): InteractiveTutorial => ({ id, title, intro, version: 1, steps });

export const TOOL_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  variables: t('variables', 'Catálogo de Variables', 'Qué son los datos que usan tus decisiones.', [
    {
      id: 'what',
      title: '¿Qué veo aquí?',
      content:
        'El catálogo de todos los DATOS que una decisión puede usar: edad, ingreso, score… Cada variable tiene un código estable, un tipo y una versión. Es el vocabulario del sistema.',
    },
    {
      id: 'add',
      title: 'Crear una variable',
      content:
        'Con “Add Variable” defines un dato nuevo. Cada campo tiene un ⓘ que explica qué poner. El código va en MAYÚSCULAS y no cambia entre versiones.',
    },
  ]),
  'reason-codes': t(
    'reason-codes',
    'Catálogo de Reason Codes',
    'Los motivos explicables de cada decisión.',
    [
      {
        id: 'what',
        title: '¿Para qué existe?',
        content:
          'Un reason code es el MOTIVO que acompaña una decisión (por qué se aprobó o rechazó). Es la base de la transparencia y de los avisos legales al cliente.',
      },
      {
        id: 'msgs',
        title: 'Mensaje público vs interno',
        content:
          'El mensaje público lo ve el cliente (claro, sin tecnicismos); el interno lo ve el analista. Marca “adverse action” si legalmente debe notificarse.',
      },
    ],
  ),
  artifacts: t('artifacts', 'Inventario de Artefactos', 'Todos los algoritmos de decisión.', [
    {
      id: 'what',
      title: '¿Qué es un artefacto?',
      content:
        'Un artefacto es un algoritmo de decisión versionable: su grafo, sus reglas y su contrato de entradas/salidas. Aquí ves y creas todos los del sistema.',
    },
    {
      id: 'next',
      title: 'De aquí al editor',
      content:
        'Abre uno para ver sus versiones y saltar al Editor de Grafo, donde se diseña el flujo. “Algoritmos y Versiones” te da la vista desplegable con el historial.',
    },
  ]),
  algorithms: t('algorithms', 'Algoritmos y Versiones', 'Tabla desplegable de algoritmos.', [
    {
      id: 'what',
      title: '¿Qué veo?',
      content:
        'Cada fila es un algoritmo. Despliégala para ver sus versiones, en qué estado está cada una (borrador, en revisión, publicada…) y quién la creó.',
    },
    {
      id: 'act',
      title: 'Actuar sobre una versión',
      content:
        'Desde cada versión saltas a su grafo, a validarla/compilarla o a sus pruebas. Filtra por estado para hallar lo pendiente.',
    },
  ]),
  'test-suites': t('test-suites', 'Suites de Prueba', 'Comprobar que una versión decide bien.', [
    {
      id: 'what',
      title: '¿Qué es una suite?',
      content:
        'Una suite comprueba que una versión decide como esperas: defines entradas y el resultado esperado, y se ejecuta automáticamente. Una suite bloqueante frena el despliegue si falla.',
    },
    {
      id: 'run',
      title: 'Ejecutar y leer resultados',
      content:
        'Al correr la suite, cada caso pasa (verde) o falla (rojo) comparando el resultado real con el esperado. Los fallos te dicen qué caso y por qué.',
    },
  ]),
  'test-cases': t('test-cases', 'Casos de Prueba', 'Los ejemplos individuales de una suite.', [
    {
      id: 'what',
      title: '¿Qué es un caso?',
      content:
        'Un caso es un ejemplo concreto: unas entradas (p. ej. ingreso 4000, sin deuda) y el resultado que debería dar (aprobado). La suite agrupa muchos casos.',
    },
  ]),
  deployments: t('deployments', 'Historial de Despliegues', 'Publicar una versión a un ambiente.', [
    {
      id: 'what',
      title: '¿Qué es un despliegue?',
      content:
        'Publicar una versión aprobada a un ambiente (sandbox, test o producción) para que empiece a resolver decisiones ahí. Aquí queda el registro auditable.',
    },
    {
      id: 'role',
      title: 'Requisitos',
      content:
        'Desplegar requiere rol Platform Admin y una versión APROBADA, y el autor no puede desplegar su propia versión (separación de funciones). Si el botón está deshabilitado, es por eso.',
    },
  ]),
  environments: t('environments', 'Gestión de Ambientes', 'Dónde corren tus decisiones.', [
    {
      id: 'what',
      title: '¿Qué es un ambiente?',
      content:
        'Un entorno donde vive una versión: sandbox y test para probar sin afectar nada real, producción para las decisiones reales. Cada tarjeta muestra su tipo y estado.',
    },
    {
      id: 'detail',
      title: 'Ver su historial',
      content:
        '“Detalles” muestra qué versiones se han desplegado en ese ambiente y con qué resultado. Así sabes qué está activo dónde.',
    },
  ]),
  simulator: t('simulator', 'Simulador de Decisión', 'Probar sin afectar producción.', [
    {
      id: 'what',
      title: '¿Para qué sirve?',
      content:
        'Prueba cómo decidiría un algoritmo con las entradas que tú escribas, sin crear una decisión real ni guardar nada. Ideal para entender por qué el motor toma una ruta.',
    },
    {
      id: 'run',
      title: 'Cómo ejecutar',
      content:
        'Elige el artefacto, escribe las variables (Formulario o JSON) y pulsa “Ejecutar simulación”. Necesita que el artefacto esté desplegado en el ambiente elegido.',
    },
  ]),
  'live-execution': t('live-execution', 'Ejecución en Vivo', 'Ver el motor decidir paso a paso.', [
    {
      id: 'what',
      title: '¿Qué muestra?',
      content:
        'Ejecuta una decisión y te muestra, nodo por nodo, el camino que recorre el motor en tiempo real. Solo en ambientes seguros (sandbox/test).',
    },
  ]),
  'code-import': t('code-import', 'Importar Código', 'Crear un algoritmo desde un script.', [
    {
      id: 'what',
      title: '¿Qué hace?',
      content:
        'Pegas un script (Python/JS) que lee variables y devuelve un resultado, y el sistema lo analiza para construir el contrato (entradas/salidas) y un borrador de grafo.',
    },
    {
      id: 'flow',
      title: 'De código a decisión',
      content:
        'Tras analizar, revisas el contrato detectado, guardas el borrador y confirmas para validar y compilar. Es la vía rápida para crear un algoritmo completo.',
    },
  ]),
  reviews: t('reviews', 'Bandeja de Revisiones', 'Aprobar versiones antes de producción.', [
    {
      id: 'what',
      title: '¿Qué es?',
      content:
        'Las solicitudes de aprobación que deben resolverse (Quality, Riesgo, Compliance) antes de que una versión pueda desplegarse. Deja evidencia de quién aprobó qué y cuándo.',
    },
  ]),
};

/** Ruta exacta → id de tutorial. Las páginas de detalle ya colocan su propio botón. */
export const ROUTE_TUTORIAL: Readonly<Record<string, string>> = {
  '/variables': 'variables',
  '/reason-codes': 'reason-codes',
  '/artifacts': 'artifacts',
  '/algorithms': 'algorithms',
  '/test-suites': 'test-suites',
  '/test-cases': 'test-cases',
  '/deployments': 'deployments',
  '/environments': 'environments',
  '/simulator': 'simulator',
  '/live-execution': 'live-execution',
  '/code-import': 'code-import',
  '/reviews': 'reviews',
};
