import type { InteractiveTutorial } from './interactive-types';

/**
 * Los dos recorridos del editor de grafo.
 *
 * `graph-editor` es el mapa de la pantalla: qué hace cada herramienta, una por
 * una. `graph-editor-algoritmo` es el otro tipo de pregunta —«vale, ¿y cómo
 * construyo uno?»— y se responde construyéndolo: cada paso pide la acción real
 * sobre el control real, así que al terminar hay un algoritmo hecho, no un
 * texto leído.
 *
 * Los `target` usan selectores estables (`data-tutorial-id` o clases que el
 * componente ya define), nunca clases de presentación.
 */

/**
 * `optional` marca los pasos cuyo objetivo puede no existir todavía: sin una
 * versión cargada no hay lienzo con nodos, ni revisión de flujo, ni notas. Un
 * paso obligatorio contra un objetivo ausente deja el recorrido esperando para
 * siempre; uno opcional se salta y el recorrido sigue.
 */
export const EDITOR_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  'graph-editor': {
    id: 'graph-editor',
    title: 'El editor de grafo, herramienta por herramienta',
    intro: 'Qué hace cada control de esta pantalla y cuándo se usa.',
    version: 3,
    steps: [
      {
        id: 'intro',
        title: 'El lienzo de la decisión',
        content:
          'Aquí se dibuja, como un diagrama, el camino que sigue una decisión: entran datos, se evalúan condiciones y se llega a un resultado (aprobado, rechazado o a revisión). Este recorrido presenta las herramientas; el otro —«Construye tu primer algoritmo»— las usa.',
      },
      {
        id: 'version',
        target: '.editor-version-control',
        title: 'Selector de versión',
        content:
          'Todo empieza eligiendo qué versión vas a diseñar. Sólo se puede editar una versión en BORRADOR: las aprobadas quedan congeladas para que su historia sea auditable. «Cargar» trae su grafo al lienzo.',
        tip: 'Si entras desde la ficha de un artefacto, la versión ya viene cargada.',
      },
      {
        id: 'steps',
        target: '.graph-authoring-steps',
        title: 'El paso a paso, siempre visible',
        content:
          'Los cuatro estados del diseño: cargar versión, diseñar el flujo, conectar las rutas y validar. Se van marcando solos según lo que lleves hecho, así que dicen en qué punto estás sin tener que buscarlo.',
      },
      {
        id: 'datos',
        target: '.editor-section',
        title: 'Datos y contrato',
        content:
          'Plegado ocupa una fila y su resumen dice lo que hay dentro: «3 entradas · 2 salidas» o, en ámbar, «sin entradas». Dentro se declara qué datos ENTRAN, qué resultados SALEN, qué valores intermedios se calculan por el camino y qué acciones puede ejecutar un paso.',
        tip: 'Va plegado a propósito: desplegado empujaba el lienzo fuera de la pantalla.',
      },
      {
        id: 'library',
        target: '.node-library',
        title: 'Biblioteca de bloques',
        content:
          'Cada bloque hace una cosa: INICIO es la entrada, CONDICIÓN bifurca según una regla, SWITCH enruta en varios casos, EXPRESIÓN y SCORE calculan con código, REVISIÓN MANUAL deriva a una persona y RESULTADO cierra el camino. Arrástralo al lienzo o pulsa el «+».',
      },
      {
        id: 'canvas',
        target: '.graph-canvas',
        title: 'El lienzo',
        content:
          'Es una ventana sobre un mundo más grande que la pantalla: desplázate en los dos ejes para recorrer el flujo. Arrastra un bloque para moverlo; haz clic para abrir sus propiedades a la derecha.',
        optional: true,
      },
      {
        id: 'zoom',
        target: '.editor-zoom-group',
        title: 'Escala',
        content:
          'Aleja para ver el flujo entero, acerca para trabajar en un detalle. El porcentaje del medio es un botón: devuelve la escala al 100 %.',
      },
      {
        id: 'layout',
        target: '.editor-layout-button',
        title: 'Ordenar',
        content:
          'Recoloca todo el grafo como un árbol de izquierda a derecha. Útil cuando has añadido bloques sueltos y el dibujo dejó de leerse.',
      },
      {
        id: 'detail',
        target: '.editor-detail-button',
        title: 'Detallado / Compacto',
        content:
          'En «Detallado» cada bloque muestra la regla que aplica y qué variables usa. En «Compacto» sólo su nombre: sirve para abarcar de un vistazo un grafo con muchos nodos.',
      },
      {
        id: 'connect',
        target: '[data-tutorial-id="graph-connect"]',
        title: 'Conectar',
        content:
          'Activa el modo conexión y haz clic primero en el bloque de origen y luego en el de destino. De una condición salen dos caminos: el «sí» y el «no / por defecto».',
      },
      {
        id: 'properties',
        target: '.node-properties',
        title: 'Propiedades del bloque',
        content:
          'Todo lo que configura el bloque seleccionado: su nombre, su regla, qué variable escribe y con qué motivo. Cambia según el tipo de bloque — una condición pide una comparación; un resultado, un desenlace y sus reason codes.',
        optional: true,
      },
      {
        id: 'history',
        target: '[aria-label="Historial"]',
        title: 'Deshacer y rehacer',
        content:
          'Cada cambio del grafo queda en un historial local. Experimenta sin miedo: nada llega al motor hasta que pulses «Guardar».',
      },
      {
        id: 'analisis',
        target: '.editor-section:last-of-type',
        title: 'Análisis del flujo',
        content:
          'Debajo del lienzo, también plegable. Reúne los recorridos posibles (qué le pasa a cada tipo de caso), la revisión que avisa de lo que impediría publicar —bloques sin salida, caminos sin final— y las notas donde se documenta el porqué de cada rama.',
        optional: true,
      },
      {
        id: 'validate',
        target: '[data-tutorial-id="graph-validate"]',
        title: 'Validar y guardar',
        content:
          'Validar comprueba la estructura y las expresiones del grafo completo contra el motor; guardar escribe la versión borrador. Sólo un grafo válido puede compilarse, probarse y desplegarse.',
        tip: 'Ahora haz el recorrido «Construye tu primer algoritmo»: usa todo esto para dejar uno terminado.',
      },
    ],
  },

  'graph-editor-algoritmo': {
    id: 'graph-editor-algoritmo',
    title: 'Construye tu primer algoritmo',
    intro: 'De la pantalla en blanco a una decisión validada, paso a paso.',
    version: 1,
    steps: [
      {
        id: 'que-vamos-a-hacer',
        route: '/graph-editor',
        title: 'Lo que vas a construir',
        content:
          'Una decisión mínima pero completa: recibe un dato del solicitante, comprueba una regla y termina en un desenlace. Ese esqueleto —entrada, condición, dos finales— es el mismo de cualquier política, por grande que sea.',
        tip: 'Este recorrido espera acciones de verdad. Si un paso se te atraviesa, «Saltar este paso» sigue adelante.',
      },
      {
        id: 'cargar-version',
        target: '.editor-version-control select, .editor-version-control input',
        title: '1 · Elige la versión borrador',
        content:
          'Un algoritmo siempre se diseña sobre una versión concreta de un artefacto. Elige una en estado BORRADOR y pulsa «Cargar»: es lo único que se puede editar.',
        tip: 'Si no hay ninguna, créala antes desde Artefactos → tu artefacto → Nueva versión.',
        optional: true,
      },
      {
        id: 'abrir-datos',
        target: '.editor-section h2 button',
        title: '2 · Abre «Datos y contrato»',
        content:
          'Antes de dibujar nada hay que decir con qué datos se decide. Pulsa la cabecera para desplegar la sección.',
        requiredAction: 'click',
        optional: true,
      },
      {
        id: 'declarar-entrada',
        target: '.input-contract-panel',
        title: '3 · Declara una ENTRADA',
        content:
          'Las entradas son los datos que la decisión recibe: el ingreso mensual, el score de buró, la edad. Elige una del catálogo y pulsa «Añadir entrada». Hasta que declares alguna, los selectores de condiciones estarán vacíos: no hay nada sobre lo que decidir.',
        tip: 'La estrella marca si es obligatoria. Si falta una obligatoria al evaluar, el motor no decide: falla cerrado.',
        optional: true,
      },
      {
        id: 'declarar-salida',
        target: '.output-contract-panel:not(.input-contract-panel)',
        title: '4 · Declara una SALIDA',
        content:
          'Las salidas son lo que la decisión DEVUELVE. Añade al menos una y márcala como principal (la estrella): es el desenlace que resume la decisión. Sin salidas, el algoritmo no devolvería nada.',
        optional: true,
      },
      {
        id: 'cerrar-datos',
        target: '.editor-section h2 button',
        title: '5 · Vuelve a plegar la sección',
        content:
          'Con los datos declarados, pliega «Datos y contrato» para recuperar el lienzo entero. Puedes volver a abrirla cuando necesites otra variable.',
        requiredAction: 'click',
        optional: true,
      },
      {
        id: 'inicio',
        target: '.node-library',
        title: '6 · Pon el bloque INICIO',
        content:
          'Todo recorrido arranca en un único punto de entrada. Arrastra «Inicio» al lienzo, o pulsa su «+». Es el bloque que recibe las variables de entrada.',
        optional: true,
      },
      {
        id: 'condicion',
        target: '.node-library',
        title: '7 · Añade una CONDICIÓN',
        content:
          'Es la pregunta que bifurca el flujo: «¿el ingreso es mayor o igual a 3.000?». Arrastra «Condición» al lienzo, a la derecha del inicio.',
        tip: 'Si el cálculo necesita código en vez de una comparación simple, usa «Expresión» o «Score».',
        optional: true,
      },
      {
        id: 'configurar-condicion',
        target: '.node-properties',
        title: '8 · Escribe la regla',
        content:
          'Con la condición seleccionada, el panel de la derecha pide la variable, el operador y el valor de comparación. Elige la entrada que declaraste en el paso 3: por eso había que declararla primero.',
        optional: true,
      },
      {
        id: 'resultados',
        target: '.node-library',
        title: '9 · Añade dos RESULTADOS',
        content:
          'Una condición tiene dos salidas, y las dos deben terminar en algún sitio: un camino no puede quedarse a medias. Añade dos bloques «Resultado» —por ejemplo aprobado y rechazado— y dales su desenlace y su motivo en el panel de propiedades.',
        tip: 'El motivo (reason code) es lo que después explica al cliente por qué se decidió así.',
        optional: true,
      },
      {
        id: 'conectar',
        target: '[data-tutorial-id="graph-connect"]',
        title: '10 · Conecta las rutas',
        content:
          'Activa «Conectar» y une los bloques haciendo clic primero en el origen y luego en el destino: inicio → condición, y de la condición a cada resultado. Una de las dos ramas es el «sí» y la otra el «no / por defecto».',
        requiredAction: 'click',
      },
      {
        id: 'revisar',
        target: '.editor-section:last-of-type',
        title: '11 · Revisa el flujo',
        content:
          'Abre «Análisis del flujo». La revisión lista lo que impediría publicar —bloques sin salida, caminos que no llegan a un final, condiciones sin definir— y cada aviso salta al bloque que lo causa. Los recorridos te enseñan qué le pasa a cada tipo de caso.',
        optional: true,
      },
      {
        id: 'notas',
        target: '.graph-notes',
        title: '12 · Documenta el porqué',
        content:
          'Las notas explican, en palabras, por qué existe cada rama y qué supone la decisión. El dibujo dice QUÉ hace; esto dice POR QUÉ, que es lo que agradecerá quien lo revise o lo herede.',
        optional: true,
      },
      {
        id: 'validar',
        target: '[data-tutorial-id="graph-validate"]',
        title: '13 · Valida contra el motor',
        content:
          'Validar manda el grafo completo al motor, que comprueba su estructura y sus expresiones de verdad. Si algo falla, el diálogo dice qué y dónde.',
        requiredAction: 'click',
      },
      {
        id: 'guardar',
        target: '.editor-toolbar-actions .button-primary',
        title: '14 · Guarda el borrador',
        content:
          'Hasta ahora todo vivía en tu navegador. Guardar escribe la versión borrador en el motor. A partir de aquí el algoritmo ya se puede probar con casos, enviar a revisión y desplegar.',
        tip: 'Lo siguiente es Suites de Prueba: escribe casos con su entrada y su resultado esperado, y ejecútalos.',
      },
    ],
  },
};
