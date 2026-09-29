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
          'La columna «Modalidad» distingue las construidas con el catálogo cerrado de operaciones de las escritas en código. Las primeras no pueden hacer nada que el catálogo no permita; las segundas se ejecutan en el entorno seguro de ejecución y pasan por una revisión automática del código, con su tope de tres líneas ejecutables.',
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
          'Ejecuta la versión con valores de ejemplo en el mismo entorno seguro que usa producción: lo que veas aquí es lo que pasará de verdad. En «Datos de prueba» elige la clase —«Válidos», «En el límite del contrato», «Inválidos (deben rechazarse)» o «Uno por cada tipo de salida»—, cuántos casos y, si quieres, una semilla; luego pulsa «Generar».',
        tip: 'Bajo el formulario aparece la semilla usada: escríbela en «Semilla» con la misma clase y el mismo número de casos para repetir exactamente el lote.',
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
          'Ese código se ejecuta dentro de decisiones reales sobre clientes. Una librería que nadie revisó puede leer datos que no le tocan, conectarse a otros sistemas o cambiar de comportamiento entre versiones sin avisar. Por eso la lista se aprueba una vez, con versión fija, y no se amplía desde el editor.',
      },
      {
        id: 'not-import',
        title: 'Habilitar no es importar',
        content:
          'Seleccionar una librería en un campo calculado NO instala nada nuevo: sólo habilita funciones que ya estaban presentes y revisadas en el entorno seguro de ejecución. Si la que necesitas no está en esta lista, la respuesta no es escribirla en el código —se rechaza al guardar—, es pedir que se revise y se apruebe.',
        tip: 'La columna «Funciones permitidas» es la lista real: una librería aprobada no habilita todas sus funciones.',
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
    title: 'Laboratorio de pruebas: cientos de casos que nadie escribió',
    intro:
      'Las pruebas escritas a mano comprueban lo que se te ocurrió. El Laboratorio de pruebas inventa casos a partir de las reglas de entrada del algoritmo —válidos, en el límite e inválidos—, con datos realistas del generador de datos, los ejecuta en el motor y te guarda, reducido, cada caso que incumple una comprobación técnica.',
    version: 2,
    steps: [
      {
        id: 'version',
        route: '/qa-lab',
        target: '[data-tutorial-id="qa-lab-version"]',
        title: '1. Elige el algoritmo y una versión compilada',
        content:
          'Primero el artefacto y luego la versión. Sólo se puede probar una versión COMPILADA: las que no lo están aparecen al final de la lista, deshabilitadas y con el motivo. De la versión salen las reglas de entrada que usará el generador.',
        tip: 'Si la versión que buscas está deshabilitada, compílala en «Validar y compilar» y vuelve.',
      },
      {
        id: 'use-version',
        target: '[data-tutorial-id="qa-lab-use-version"]',
        title: '2. Pulsa «Usar esta versión»',
        content:
          'Hasta que no la confirmas no aparece la configuración de la corrida. Pulsa el botón resaltado para seguir.',
        requiredAction: 'click',
      },
      {
        id: 'config',
        target: '[data-tutorial-id="qa-lab-config"]',
        title: '3. Decide cuántos casos y de qué clase',
        content:
          'Válidos: cumplen todas las reglas y el motor debe aceptarlos. En el límite: válidos pero pegados al borde de una regla (edad mínima exacta, monto máximo). Inválidos: rompen a propósito una regla y el motor debe rechazarlos. La semilla es el nombre del lote: con la misma semilla, la misma configuración y la misma versión se generan los mismos casos.',
        tip: 'Deja marcado «un caso por cada resultado posible» para que ninguna decisión del algoritmo (aprobar, rechazar, revisar…) quede sin ejecutar.',
      },
      {
        id: 'fakers',
        target: '[data-tutorial-id="qa-lab-fakers"]',
        title: '4. De dónde salen los datos',
        content:
          'Las variables cuyo nombre dice qué dato son —nombre, carnet, celular, correo, fecha de nacimiento, ingreso, banco, NIT…— se rellenan con el generador de datos realistas, con la misma semilla y ajustados a las reglas del contrato. Lo demás sale del propio contrato. Si el generador no responde, todo sale del contrato y el resultado te lo avisa.',
      },
      {
        id: 'launch',
        target: '[data-tutorial-id="qa-lab-launch"]',
        title: '5. Lanza la corrida',
        content:
          'Pulsa el botón resaltado. La corrida se ejecuta en el motor, no en esta pestaña: verás el avance y puedes irte y volver.',
        requiredAction: 'click',
      },
      {
        id: 'summary',
        target: '[data-tutorial-id="qa-lab-summary"]',
        title: '6. Lee el resumen',
        content:
          '«Con fallo» son casos que incumplen alguna comprobación técnica: que el contrato se imponga, que la salida esté completa y con sus tipos, que no se filtren cálculos internos ni datos sensibles y, si lo activas, que la misma entrada dé el mismo resultado. No juzga si la decisión es buena para el negocio: eso lo dicen las suites de prueba. Debajo verás si la corrida se cortó por tiempo o en el primer fallo, y de dónde salieron los datos.',
      },
      {
        id: 'counterexamples',
        target: '[data-tutorial-id="qa-lab-counterexamples"]',
        title: '7. Los contraejemplos, reducidos',
        content:
          'Cada caso que falla se recorta a lo mínimo que sigue fallando y se enseña como tabla de variable y valor. «Volver a ejecutar este caso» lo repite con su misma clase (válido, en el límite o inválido) para confirmar si el fallo sigue.',
        tip: 'Para convertirlo en una prueba permanente, copia sus valores en un caso de una suite de prueba con el resultado que esperas.',
      },
      {
        id: 'history',
        target: '[data-tutorial-id="qa-lab-history"]',
        title: '8. Repetir una corrida',
        content:
          '«Reproducir» vuelve a poner en el formulario la semilla, la versión y TODA la configuración de aquella corrida. Así puedes comparar una versión nueva contra el mismo lote.',
      },
    ],
  },
};
