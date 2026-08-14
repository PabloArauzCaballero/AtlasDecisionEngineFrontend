import type { InteractiveTutorial } from './interactive-types';

/**
 * Recorridos de la TRAZA: qué decidió el motor (`/executions`), quién administró la
 * plataforma (`/audit-events`) y qué se le contesta a una persona que pregunta por sus
 * datos (`/data-subject-requests`).
 *
 * Las tres pantallas de la sección «Auditoría» llegaron sin ninguna ayuda guiada, y son
 * justo las que usa gente que no diseñó el sistema: un auditor externo, cumplimiento, el
 * canal de atención. El buscador de ejecuciones tenía recorrido sólo en la FICHA
 * (`execution-detail`), así que quien abría el listado no encontraba nada.
 */
const t = (
  id: string,
  title: string,
  intro: string,
  steps: InteractiveTutorial['steps'],
): InteractiveTutorial => ({ id, title, intro, version: 1, steps });

export const AUDIT_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  executions: t(
    'executions',
    'Buscador de Ejecuciones',
    'Encontrar una decisión concreta entre todas las que el motor ya tomó.',
    [
      {
        id: 'what',
        title: '¿Qué se busca aquí?',
        content:
          'Cada fila es una decisión REAL que el motor ya tomó: sus entradas, su resultado, el ambiente en el que ocurrió y cuánto tardó. No se puede editar ninguna; esta pantalla sólo mira hacia atrás.',
        tip: 'Si lo que quieres es probar cómo decidiría un algoritmo, eso es el Simulador: allí nada queda registrado como decisión.',
      },
      {
        id: 'filters',
        target: '[data-tutorial-id="resource-filters"]',
        title: 'Empieza por el artefacto',
        content:
          'El filtro principal acota por algoritmo. Es el primer corte natural: casi ninguna pregunta de auditoría es «todas las decisiones», sino «las de esta política».',
        optional: true,
      },
      {
        id: 'more-filters',
        target: '[data-tutorial-id="resource-more-filters"]',
        title: 'Los filtros que resuelven un caso',
        content:
          'Detrás de este icono están el resultado (aprobado, rechazado, derivado a revisión), el rango de fechas y el Request ID. Con el Request ID se llega a UNA decisión exacta, que es como llega casi siempre un reclamo.',
        tip: 'El número sobre el icono dice cuántos filtros tienes puestos: una lista corta puede ser un filtro olvidado, no la realidad.',
        optional: true,
      },
      {
        id: 'table',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Leer la tabla',
        content:
          'La cabecera dice cuántas decisiones cumplen el filtro. «Outcome» es el resultado de negocio y «Duración» lo que tardó el motor; el ambiente distingue una decisión de producción de una de pruebas.',
      },
      {
        id: 'open',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Abre una para ver el porqué',
        content:
          'El icono «Ver detalle» —el ojo, al final de la fila— abre la ficha con las entradas, las salidas y la traza nodo a nodo. Ahí se ve qué condición decidió el resultado, que es lo que hay que enseñar cuando alguien reclama.',
        tip: 'Ese detalle tiene su propio recorrido: «Detalle de una ejecución», en el Centro de Tutoriales.',
        requiredAction: 'click',
        optional: true,
      },
      {
        id: 'reproducible',
        title: 'Por qué esto es reproducible',
        content:
          'Cada ejecución guarda la versión exacta del algoritmo que la resolvió, así que se puede volver a ejecutar el mismo caso contra la misma versión años después. Sin esa versión guardada, «así decidíamos entonces» sería una afirmación sin prueba.',
      },
    ],
  ),
  'audit-events': t(
    'audit-events',
    'Bitácora de Auditoría',
    'Quién hizo qué en la plataforma, en una cadena que no se puede reescribir.',
    [
      {
        id: 'what',
        title: 'Esto no son decisiones, son actos',
        content:
          'La bitácora registra lo que las PERSONAS hicieron en la plataforma: crear una versión, aprobarla, desplegarla, cambiar un permiso. Las decisiones del motor viven en el buscador de ejecuciones; son dos preguntas distintas y conviene no confundirlas.',
      },
      {
        id: 'chain',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Las dos columnas de hash',
        content:
          'Cada evento guarda su propia huella y la del anterior, así que los eventos forman una cadena. Alterar uno cambia su huella y rompe el enlace con todos los siguientes: por eso se puede afirmar que el registro no se ha tocado, en vez de pedir que se confíe.',
        tip: 'Un hueco en la cadena no es un evento que falta: es un registro que alguien manipuló.',
      },
      {
        id: 'search',
        target: '[data-tutorial-id="resource-filters"]',
        title: 'Buscar por evento, actor o IP',
        content:
          'La búsqueda principal cubre el tipo de evento, quién lo hizo y desde dónde. Es el camino para responder «¿quién aprobó esta versión?» sin recorrer la cadena entera.',
        optional: true,
      },
      {
        id: 'aggregate',
        target: '[data-tutorial-id="resource-more-filters"]',
        title: 'Seguir un objeto concreto',
        content:
          'Con «Actor» y «Tipo de agregado» se sigue la vida de una cosa: todos los eventos sobre artefactos, o todo lo que hizo una persona. Así se reconstruye una secuencia completa en vez de leer sucesos sueltos.',
        optional: true,
      },
      {
        id: 'segregation',
        title: 'Para qué sirve de verdad',
        content:
          'La bitácora es lo que demuestra la separación de funciones: que quien creó una versión no fue quien la aprobó, ni quien la desplegó. Esa prueba es la primera que pide una auditoría, y es imposible de reconstruir a mano.',
      },
    ],
  ),
  'data-subject-requests': t(
    'data-subject-requests',
    'Derechos del titular',
    'Contestar a una persona que pregunta qué decidió el motor sobre ella.',
    [
      {
        id: 'what',
        title: '¿Qué se atiende aquí?',
        content:
          'Las solicitudes de una persona sobre sus propios datos: acceso a las decisiones que se tomaron sobre ella, portabilidad, eliminación y revisión humana de una decisión automática. Son derechos con plazo legal, no consultas de cortesía.',
      },
      {
        id: 'subject',
        target: '[data-tutorial-id="dsr-subject"]',
        title: 'La referencia del titular',
        content:
          'Es el mismo identificador con el que se ejecutaron las decisiones. Si no coincide, la respuesta saldrá vacía y parecerá que no hay nada, cuando lo que pasa es que se preguntó por otra persona.',
        tip: 'Esta referencia nunca viaja en la dirección del navegador, ni siquiera para consultar el historial: un identificador en una URL acaba escrito en el registro de acceso, en el proxy y en la traza.',
        requiredAction: 'input',
        optional: true,
      },
      {
        id: 'type',
        target: '[data-tutorial-id="dsr-type"]',
        title: 'Elige el derecho ejercido',
        content:
          'Cada derecho produce una respuesta distinta y deja un expediente distinto. El texto de debajo explica qué hace exactamente el que tienes elegido, porque «acceso» y «portabilidad» se parecen y no son lo mismo.',
      },
      {
        id: 'submit',
        target: '[data-tutorial-id="dsr-submit"]',
        title: 'Registrar ES atender',
        content:
          'No hay guardar borrador: al pulsar, el motor abre el expediente y lo resuelve contra el historial en la misma llamada. Queda constancia de que alguien consultó todas las decisiones sobre esa persona, porque esa consulta es en sí misma un acceso a sus datos.',
        requiredAction: 'click',
        optional: true,
      },
      {
        id: 'result',
        target: '[data-tutorial-id="dsr-result"]',
        title: 'La resolución',
        content:
          'Aquí aparece lo que se le puede entregar a la persona y con qué fundamento se resolvió. Es el documento que contesta la solicitud, no un resumen para uso interno.',
        optional: true,
      },
      {
        id: 'history',
        target: '[data-tutorial-id="dsr-history"]',
        title: 'Lo que ya se le contestó antes',
        content:
          'Muestra las solicitudes anteriores de ese mismo titular, con quién las atendió y cuándo se resolvieron. Sirve para no contestar dos veces cosas distintas a la misma pregunta.',
        tip: 'Que un titular no tenga solicitudes previas no significa que no haya decisiones sobre él: eso lo responde el derecho de acceso.',
        optional: true,
      },
    ],
  ),
};
