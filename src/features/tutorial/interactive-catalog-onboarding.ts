import type { InteractiveTutorial } from './interactive-types';

/**
 * Recorridos de entrada: qué es ATLAS, cómo moverse, cómo está tu sesión y cómo
 * volver a la ayuda. Son los únicos tutoriales que atraviesan el armazón de la
 * aplicación (barra lateral y superior) en lugar de una pantalla concreta, y por
 * eso apuntan a elementos del layout, no de una vista.
 *
 * Texto para alguien que abre el portal por primera vez y no sabe qué es un
 * "artefacto": cada paso explica el concepto antes de nombrar el botón.
 */

const PLATFORM_HEALTH = '/platform-health';

export const ONBOARDING_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  welcome: {
    id: 'welcome',
    title: 'Qué es ATLAS y cómo se usa',
    intro:
      'En tres minutos entiendes qué gobierna este portal y cuál es el camino que recorre una decisión, de la idea al ambiente productivo.',
    version: 1,
    steps: [
      {
        id: 'what',
        route: PLATFORM_HEALTH,
        title: 'ATLAS decide, tú defines cómo',
        content:
          'Este portal no atiende clientes: define y vigila las reglas con las que el motor decide. Aprobar un crédito, marcar una transacción como sospechosa o pedir revisión humana son resultados de un algoritmo que se diseña aquí, se prueba y se aprueba antes de tocar producción.',
        tip: 'Nada de lo que hagas en el portal afecta a producción hasta que alguien con permiso lo despliega.',
      },
      {
        id: 'health',
        target: '[data-tutorial-id="dashboard-metrics"]',
        title: 'La pantalla de estado',
        content:
          'Esta primera vista resume la salud de la plataforma: cuántas decisiones se ejecutaron, cuántas fallaron y qué está esperando a alguien. Es el sitio al que volver cuando quieras saber si algo va mal.',
        optional: true,
      },
      {
        id: 'flow',
        target: '[data-tutorial-id="sidebar-nav"]',
        title: 'El camino de una decisión',
        content:
          'El menú está ordenado como el trabajo real: en Diseño declaras los datos y dibujas el algoritmo; en Calidad lo pruebas; en Gobierno alguien lo aprueba y se despliega; en Operación se ejecuta; en Auditoría se revisa qué pasó. Ese orden es el que siguen también los tutoriales.',
        tip: 'Sólo ves las secciones que tu rol puede abrir, así que tu menú puede ser más corto que el de un compañero.',
      },
      {
        id: 'help',
        target: '[data-tutorial-id="tutorial-center-link"]',
        title: 'Nunca te quedas sin ayuda',
        content:
          'Cada pantalla tiene su propio recorrido guiado, y aquí, en el Centro de Tutoriales, están todos juntos con tu avance. Puedes retomar donde lo dejaste o repetir cualquiera cuando quieras.',
        optional: true,
      },
    ],
  },

  navigation: {
    id: 'navigation',
    title: 'Moverte por el portal',
    intro:
      'Aprende a llegar a cualquier pantalla, buscar en todo el sistema y usar los atajos, sin recorrer el menú a mano cada vez.',
    version: 1,
    steps: [
      {
        id: 'sidebar',
        route: PLATFORM_HEALTH,
        target: '[data-tutorial-id="sidebar-nav"]',
        title: 'El menú lateral',
        content:
          'Agrupa las pantallas por etapa del trabajo. La sección resaltada indica dónde estás. En pantallas estrechas se oculta y se abre con el botón de menú de la barra superior.',
      },
      {
        id: 'quick',
        target: '[data-tutorial-id="quick-action"]',
        title: 'Atajos a lo más frecuente',
        content:
          '"Quick Action" lleva de un salto a las cuatro operaciones más habituales —simular, enviar a revisión, editar el grafo y ver objetivos— sin buscarlas en el menú.',
        optional: true,
      },
      {
        id: 'search',
        target: '[data-tutorial-id="global-search"]',
        title: 'Buscar en todo el sistema',
        content:
          'Escribe aquí un código de variable, el nombre de un artefacto o el identificador de una ejecución y el portal busca en todos los dominios a la vez. Los resultados se agrupan por tipo.',
        tip: 'Si no recuerdas dónde vive algo, este buscador casi siempre es más rápido que el menú.',
        optional: true,
      },
      {
        id: 'notifications',
        target: '[data-tutorial-id="notification-center"]',
        title: 'Avisos y errores',
        content:
          'Aquí llegan los resultados de lo que lanzaste y los errores. Cuando un error tiene arreglo conocido, el aviso trae un botón que abre el tutorial que enseña a corregirlo.',
        optional: true,
      },
      {
        id: 'theme',
        target: '[data-tutorial-id="theme-toggle"]',
        title: 'Tema claro y oscuro',
        content:
          'Conmuta entre tema claro y oscuro. Tu elección se recuerda en este navegador y se aplica antes de pintar, sin parpadeo.',
        optional: true,
      },
      {
        id: 'help-menu',
        target: '[data-tutorial-id="tutorial-menu"]',
        title: 'La ayuda de cada pantalla',
        content:
          'Junto al título de cada vista está este botón: abre el recorrido guiado de esa pantalla concreta o su guía de lectura. Es el mismo motor que estás usando ahora.',
        optional: true,
      },
    ],
  },

  session: {
    id: 'session',
    title: 'Tu sesión, tu rol y el ambiente',
    intro:
      'Entiende quién eres para el sistema, qué puedes hacer con tu rol y contra qué ambiente estás trabajando, para no confundir una prueba con producción.',
    version: 1,
    steps: [
      {
        id: 'user',
        route: PLATFORM_HEALTH,
        target: '[data-tutorial-id="user-summary"]',
        title: 'Quién eres para el portal',
        content:
          'Tu nombre y tu área. De tu rol depende todo lo que ves: si una pantalla no aparece en el menú o un botón está deshabilitado, casi siempre es el permiso, no un fallo.',
        tip: 'Si necesitas acceso a algo, pídelo por rol —analista de riesgo, QA, cumplimiento—, no por pantalla.',
      },
      {
        id: 'environment',
        target: '[data-tutorial-id="environment-chip"]',
        title: 'Contra qué ambiente trabajas',
        content:
          'Indica si estás en producción o en un ambiente de prueba. Míralo antes de desplegar o de lanzar una ejecución: es la diferencia entre un ensayo y una decisión real sobre un cliente.',
        optional: true,
      },
      {
        id: 'logout',
        target: '[data-tutorial-id="logout"]',
        title: 'Cerrar sesión',
        content:
          'Libera tu canal seguro y te devuelve al acceso. Conviene hacerlo si compartes el equipo, porque la sesión sigue viva mientras no se cierre.',
        optional: true,
      },
    ],
  },

  'tutorial-center': {
    id: 'tutorial-center',
    title: 'Usar el Centro de Tutoriales',
    intro:
      'Aprende a encontrar el recorrido que necesitas, ver tu avance y retomar lo que dejaste a medias.',
    version: 1,
    steps: [
      {
        id: 'progress',
        route: '/tutorials',
        target: '[data-tutorial-id="tutorial-center-progress"]',
        title: 'Tu avance general',
        content:
          'Resume cuántos recorridos has terminado sobre los que tu rol puede ver. No cuenta los de otros roles, así que el 100 % es alcanzable de verdad.',
      },
      {
        id: 'search',
        target: '[data-tutorial-id="tutorial-center-search"]',
        title: 'Buscar un tutorial',
        content:
          'Escribe una palabra del título o de la descripción para filtrar la lista al instante. Útil cuando sabes qué quieres aprender pero no en qué módulo vive.',
        optional: true,
      },
      {
        id: 'filters',
        target: '[data-tutorial-id="tutorial-center-filters"]',
        title: 'Filtrar por módulo, estado o nivel',
        content:
          'Acota por categoría —diseño, calidad, gobierno…—, por si lo tienes pendiente o completado, y por dificultad. Los filtros se combinan entre sí.',
        optional: true,
      },
      {
        id: 'card',
        target: '[data-tutorial-id="tutorial-center-list"]',
        title: 'Cada tarjeta dice qué esperar',
        content:
          'Muestra cuánto dura, qué nivel tiene, cuántos pasos son y si te falta algún recorrido previo. "Comenzar" te lleva a la pantalla real y arranca el recorrido; si lo dejaste a medias, el botón dice "Continuar" y retoma tu paso.',
        tip: 'Un recorrido ya completado se puede repetir siempre: el botón pasa a "Repetir" y no pierdes el historial.',
      },
    ],
  },
};
