import type { InteractiveTutorial } from './interactive-types';

/**
 * Tutoriales guiados de OPERACIÓN y GOBIERNO: simulador, importar código,
 * ejecución en vivo, despliegues, ambientes y revisiones. Igual que los de
 * catálogo, cada paso resalta un elemento real y varios esperan la acción de la
 * persona antes de avanzar.
 */
const t = (
  id: string,
  title: string,
  intro: string,
  steps: InteractiveTutorial['steps'],
): InteractiveTutorial => ({ id, title, intro, version: 2, steps });

export const OPS_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  simulator: t(
    'simulator',
    'Simulador de Decisión',
    'Probar cómo decidiría un algoritmo sin afectar nada real.',
    [
      {
        id: 'what',
        title: '¿Para qué sirve?',
        content:
          'Ejecuta una decisión de mentira: mismo motor, mismas reglas, pero no crea una decisión productiva ni guarda evidencia. Es la forma de entender por qué el algoritmo toma un camino.',
      },
      {
        id: 'artifact',
        target: '[data-tutorial-id="simulator-artifact"]',
        title: 'Elige el algoritmo y dónde probarlo',
        content:
          'Al elegir el artefacto, el formulario se rellena solo con las variables que ESE algoritmo declara. El ambiente debe ser seguro (sandbox o test): producción no se puede simular.',
        tip: 'Si un artefacto no aparece, es que no está desplegado en ningún ambiente seguro.',
        requiredAction: 'input',
      },
      {
        id: 'samples',
        target: '[data-tutorial-id="simulator-samples"]',
        title: 'No hace falta que teclees los datos',
        content:
          '«Generar valores» le pide al motor un juego de entradas derivado del contrato del algoritmo desplegado: válidas, en el límite o inválidas a propósito. También puedes subir un JSON o un CSV con tus propios casos.',
        tip: 'Cada generación muestra su semilla: repítela para volver a obtener exactamente los mismos valores.',
      },
      {
        id: 'inputs',
        target: '[data-tutorial-id="simulator-form"]',
        title: 'Rellena las entradas',
        content:
          'Las variables de ENTRADA son los datos que hay que aportar. Si alguna obligatoria queda vacía, un aviso te dice cuál: sin ella el motor no puede decidir y devolvería NO_DECISION.',
        tip: 'Tres vistas del mismo dato: Formulario (guiado), Atributo-valor (rápido) y JSON (para pegar un caso real).',
      },
      {
        id: 'outputs',
        title: 'Y las salidas',
        content:
          'Debajo del formulario ves las SALIDAS que devolverá esta decisión. Ésas no se rellenan: las produce el motor y son las que verás en el resultado.',
      },
      {
        id: 'run',
        target: '[data-tutorial-id="simulator-submit"]',
        title: 'Ejecuta la simulación',
        content: 'Pulsa para evaluar. Tarda milisegundos y no deja rastro en producción.',
        requiredAction: 'click',
      },
      {
        id: 'trace',
        target: '.simulation-result',
        title: 'Lee el porqué',
        content:
          'Arriba el desenlace y el resultado principal; debajo, los motivos explicables. “Ver traza de ejecución” abre el camino nodo a nodo que siguió el motor: ahí se ve exactamente qué condición decidió el resultado.',
        optional: true,
      },
    ],
  ),
  'code-import': t(
    'code-import',
    'Importar código como árbol de decisión',
    'Convertir un script en un algoritmo revisable, probable y explicable.',
    [
      {
        id: 'what',
        title: '¿Qué hace esta pantalla?',
        content:
          'Lee un script de Python o JavaScript y lo convierte en un ÁRBOL DE DECISIÓN: cada if/elif pasa a ser una condición del motor y cada rama, un resultado. Así deja de ser una caja negra.',
      },
      {
        id: 'contract',
        target: '[data-tutorial-id="code-import-form"]',
        title: 'El contrato manda',
        content:
          'La cabecera @atlas-contract declara qué ENTRADAS lee el código y qué SALIDAS devuelve. Sin ese contrato no se puede saber qué pedirle al algoritmo ni qué esperar de él.',
        tip: 'El código sólo puede leer datos a través de `variables`: no hay accesos al sistema ni a la red.',
      },
      {
        id: 'analyze',
        target: '[data-tutorial-id="code-import-analyze"]',
        title: 'Analiza el código',
        content:
          'Se comprueba la sintaxis, el contrato y la seguridad, y se deriva el árbol. Nada se ejecuta durante el análisis.',
        requiredAction: 'click',
      },
      {
        id: 'preview',
        target: '[data-tutorial-id="code-import-preview"]',
        title: 'Revisa el árbol generado',
        content:
          'El dibujo baja por el camino “no” de cada condición y muestra a la derecha el resultado de su “sí”. Si el código usa algo que no se puede traducir, se avisa con el motivo y se importa como un único nodo de script: nunca se traduce una regla a medias.',
      },
      {
        id: 'save',
        target: '[data-tutorial-id="code-import-save"]',
        title: 'Guárdalo en una versión',
        content:
          'Elige el artefacto y su versión BORRADOR de destino. “Guardar borrador” sólo escribe el grafo; “Confirmar” además lo valida y compila, dejándolo listo para pruebas.',
        optional: true,
      },
    ],
  ),
  'live-execution': t('live-execution', 'Ejecución en Vivo', 'Ver al motor decidir paso a paso.', [
    {
      id: 'what',
      title: '¿Qué muestra?',
      content:
        'Ejecuta una decisión y te muestra, nodo por nodo, el camino que recorre el motor. Sólo en ambientes seguros (sandbox o test).',
    },
    {
      id: 'steps',
      title: 'Cada paso es auditable',
      content:
        'Para cada nodo ves qué evaluó y qué rama tomó. Es la misma traza que queda guardada en una decisión real, así que sirve para aprender a leer auditorías.',
    },
  ]),
  deployments: t('deployments', 'Historial de Despliegues', 'Publicar una versión a un ambiente.', [
    {
      id: 'what',
      title: '¿Qué es un despliegue?',
      content:
        'Publicar una versión aprobada en un ambiente (sandbox, test o producción) para que empiece a resolver decisiones allí. Aquí queda el registro auditable de quién publicó qué y cuándo.',
    },
    {
      id: 'requirements',
      target: '[data-tutorial-id="resource-create"]',
      title: 'Requisitos y separación de funciones',
      content:
        'Desplegar exige rol de administrador de plataforma y una versión APROBADA; además, quien creó la versión no puede desplegarla. Si el botón está deshabilitado, es por alguna de esas reglas.',
      optional: true,
    },
    {
      id: 'rollback',
      title: 'Volver atrás',
      content:
        'Cada despliegue recuerda cuál era el anterior, así que revertir es publicar de nuevo la versión previa: nada se pierde ni se sobrescribe.',
    },
  ]),
  environments: t('environments', 'Gestión de Ambientes', 'Dónde corren tus decisiones.', [
    {
      id: 'what',
      title: '¿Qué es un ambiente?',
      content:
        'El lugar donde vive una versión: sandbox y test para probar sin consecuencias, producción para las decisiones reales de clientes.',
    },
    {
      id: 'detail',
      title: 'Qué hay activo dónde',
      content:
        'Cada tarjeta muestra su tipo y estado; “Detalles” lista qué versiones se han desplegado allí. Es la respuesta a “¿qué está decidiendo ahora mismo en producción?”.',
    },
  ]),
  reviews: t('reviews', 'Bandeja de Revisiones', 'Aprobar versiones antes de producción.', [
    {
      id: 'what',
      title: '¿Qué es?',
      content:
        'Las solicitudes de aprobación que deben resolverse (Calidad, Riesgo, Cumplimiento) antes de que una versión pueda desplegarse.',
    },
    {
      id: 'evidence',
      target: '[data-tutorial-id="resource-table"]',
      title: 'Aprobar deja evidencia',
      content:
        'Cada decisión de aprobación guarda quién, cuándo y con qué comentario, junto a los resultados de las pruebas. Eso es lo que se enseña en una auditoría.',
    },
  ]),
};
