import type { InteractiveTutorial } from './interactive-types';

/**
 * Recorridos de las capacidades §5–§10: campos calculados, librerías y QA Lab.
 *
 * Son las tres pantallas más nuevas del portal y las que llegaron SIN recorrido, que es
 * justo al revés de lo que conviene: un listado de artefactos se adivina, pero «campo
 * calculado», «prelude de librería» y «contraejemplo mínimo» no se adivinan, y quien no
 * sabe qué son tampoco sabe qué preguntar.
 *
 * El hilo conductor es el mismo en los tres: QUÉ es la pieza, POR QUÉ existe separada de
 * lo demás, y qué se rompe si se usa como si fuera otra cosa.
 */

const CALCULATED_FIELDS = '/calculated-fields';

export const LAB_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  'calculated-fields': {
    id: 'calculated-fields',
    title: 'Campos calculados: fórmulas que se comparten',
    intro:
      'Un campo calculado es una cuenta pequeña —una relación, una edad, un porcentaje— que varios algoritmos usan igual. Aquí se cataloga una vez, se versiona y se gobierna, en lugar de repetirse en cada árbol.',
    version: 1,
    steps: [
      {
        id: 'what',
        route: CALCULATED_FIELDS,
        target: '[data-tutorial-id="calculated-field-catalog"]',
        title: 'Qué es y qué NO es',
        content:
          'Cada fila es una función, no un algoritmo: recibe unas entradas y devuelve UN valor. «Deuda sobre ingreso» es un campo calculado; «aprobar o rechazar» es un artefacto de decisión. La diferencia importa porque un campo calculado no decide nada: alimenta a quien decide.',
        tip: 'Si la misma cuenta aparece escrita en dos algoritmos, es señal de que debería ser un campo calculado.',
        optional: true,
      },
      {
        id: 'kind',
        title: 'La modalidad dice cuánto hay que revisar',
        content:
          'La columna «Modalidad» distingue las construidas con el catálogo cerrado de operaciones de las escritas en código. Las primeras no pueden hacer nada que el catálogo no permita; las segundas corren en el entorno aislado y pasan por el guardián de código, con su tope de tres líneas ejecutables.',
        tip: 'Empieza siempre por el catálogo de operaciones. El código es la salida cuando la operación que necesitas no existe, no el atajo por defecto.',
        optional: true,
      },
      {
        id: 'create',
        target: '[data-tutorial-id="calculated-field-new"]',
        title: 'Crear uno',
        content:
          'El asistente pide tres cosas en este orden: cómo se llama y para qué sirve, qué entradas consume, y qué devuelve. El contrato de retorno es obligatorio: sin declarar el tipo y el rango de lo que sale, quien lo consuma no puede validar nada.',
        tip: 'El código del campo se usará dentro de los algoritmos: elígelo pensando en cómo se leerá ahí, no aquí.',
        optional: true,
      },
      {
        id: 'versions',
        route: CALCULATED_FIELDS,
        dynamicRoute: true,
        target: '[data-tutorial-id="calculated-field-versions"]',
        title: 'Una versión no se edita: se sucede',
        content:
          'Abre un campo del catálogo y verás su historial. Una versión publicada es inmutable, porque hay decisiones ya tomadas que la usaron y su explicación tiene que seguir siendo cierta años después. Cambiar la fórmula es crear la versión siguiente.',
        optional: true,
      },
      {
        id: 'try',
        target: '[data-tutorial-id="calculated-field-try"]',
        title: 'Probar antes de publicar',
        content:
          'Ejecuta la versión con valores de ejemplo contra el mismo motor aislado que usa producción: lo que veas aquí es lo que pasará de verdad. «Generar ejemplo» rellena el formulario con valores que cumplen el contrato, «En el límite» con los del borde —donde aparecen casi todos los fallos— e «Inválido» con los que el contrato DEBE rechazar.',
        tip: 'La semilla que aparece bajo el formulario reproduce exactamente el mismo lote: guárdala si encuentras un caso que falla.',
        optional: true,
      },
    ],
  },

  libraries: {
    id: 'libraries',
    title: 'Librerías: qué puede invocar el código',
    intro:
      'El código de un campo calculado no puede importar lo que quiera. Este catálogo es la lista cerrada de funciones revisadas que tiene permitido usar, con su versión exacta y los ambientes donde está habilitada.',
    version: 1,
    steps: [
      {
        id: 'why',
        route: '/libraries',
        target: '[data-tutorial-id="library-table"]',
        title: 'Por qué es una lista cerrada',
        content:
          'Ese código corre dentro de decisiones reales sobre clientes. Una dependencia que nadie revisó puede leer datos que no le tocan, salir a la red o cambiar de comportamiento entre versiones sin avisar. Por eso la lista se aprueba una vez, con versión fija, y no se amplía desde el editor.',
      },
      {
        id: 'not-import',
        title: 'Habilitar no es importar',
        content:
          'Seleccionar una librería en un campo calculado NO añade un paquete: sólo habilita funciones que ya estaban presentes y revisadas en el entorno aislado. Si la que necesitas no está en esta lista, la respuesta no es escribirla en el código —se rechaza al guardar—, es pedir que se revise y se apruebe.',
        tip: 'La columna «Funciones permitidas» es la lista real: una librería aprobada no habilita todo su paquete.',
        optional: true,
      },
      {
        id: 'environments',
        target: '[data-tutorial-id="library-filters"]',
        title: 'Ambientes y estado',
        content:
          'Filtra por lenguaje para ver sólo lo que aplica a tu implementación. Mira siempre la columna de ambientes: una librería habilitada en pruebas y no en producción hará que el campo funcione al probarlo y falle al desplegarse, que es el peor momento para enterarse.',
        optional: true,
      },
    ],
  },

  'qa-lab': {
    id: 'qa-lab',
    title: 'QA Lab: miles de casos que nadie escribió',
    intro:
      'Las pruebas escritas a mano comprueban lo que se te ocurrió. El QA Lab genera casos a partir del contrato del algoritmo —válidos, de frontera e inválidos—, los ejecuta todos y te devuelve el ejemplo más pequeño de lo que falla.',
    version: 1,
    steps: [
      {
        id: 'version',
        route: '/qa-lab',
        target: '[data-tutorial-id="qa-lab-version"]',
        title: 'Elige la versión a castigar',
        content:
          'Se prueba una versión compilada concreta, no «el algoritmo». De ella salen las entradas: el generador lee su contrato de variables —tipos, rangos, longitudes, enumeraciones— y construye los casos a partir de ahí, sin listas escritas a mano.',
        tip: 'Como los casos salen del contrato, añadir mañana una restricción hace aparecer solos los casos que la ponen a prueba.',
      },
      {
        id: 'mix',
        target: '[data-tutorial-id="qa-lab-config"]',
        title: 'La mezcla decide qué estás probando',
        content:
          'Los válidos comprueban que la política decide bien; los de frontera atacan los bordes exactos de cada restricción, que es donde se concentran los fallos; los inválidos comprueban que el contrato rechaza lo que debe rechazar. Una corrida sólo de válidos no prueba las defensas.',
        tip: 'Las distribuciones sesgan dónde caen los valores dentro del rango. Sirven para representar tu cartera real, no para relajar el contrato: nunca generan un valor prohibido.',
        optional: true,
      },
      {
        id: 'summary',
        target: '[data-tutorial-id="qa-lab-summary"]',
        title: 'Leer el resultado',
        content:
          '«Con fallo» son casos que violan alguna propiedad declarada; no son errores del motor, son decisiones que no cumplen lo que prometiste. La semilla que acompaña a la corrida la reproduce entera, valor por valor, y queda archivada junto a la versión del generador que la produjo.',
        optional: true,
      },
      {
        id: 'counterexamples',
        target: '[data-tutorial-id="qa-lab-counterexamples"]',
        title: 'El contraejemplo mínimo',
        content:
          'De un caso que falla con veinte campos no se aprende nada. El laboratorio lo reduce: quita todo lo que no influye y simplifica los valores mientras el fallo siga apareciendo. Lo que queda es la explicación más corta posible de qué está mal.',
        tip: 'Un contraejemplo reducido es un caso de prueba excelente: guárdalo en la suite del algoritmo para que el fallo no vuelva.',
        optional: true,
      },
    ],
  },
};
