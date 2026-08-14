import type { InteractiveTutorial } from './interactive-types';

/**
 * Recorridos de las TRES PANTALLAS DE MEDICIÓN, y el orden importa: calidad de la
 * decisión («¿hay datos con los que medir?»), monitoreo del modelo («¿se degrada?») y
 * gobierno del riesgo («¿bajo qué condiciones se le deja operar?»).
 *
 * Se parecen lo suficiente como para confundirlas, y confundirlas produce la lectura
 * peligrosa: un tablero de degradación en verde sobre un sistema de observación apagado.
 * Por eso cada recorrido empieza diciendo qué pregunta contesta la suya y cuál es la de
 * al lado, y por eso el monitoreo pide haber hecho antes el de calidad.
 *
 * Las tres son vistas por pestañas: el contenido de la pestaña que no está activa se
 * monta oculto, así que los pasos señalan la PESTAÑA y esperan el clic antes de hablar
 * de lo que hay dentro.
 */
const t = (
  id: string,
  title: string,
  intro: string,
  steps: InteractiveTutorial['steps'],
): InteractiveTutorial => ({ id, title, intro, version: 1, steps });

export const MEASURE_TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = {
  'decision-quality': t(
    'decision-quality',
    'Calidad de la decisión',
    'Comprobar que hay datos con los que medir, antes de creerse ninguna medida.',
    [
      {
        id: 'what',
        title: 'La pregunta anterior a todas',
        content:
          'Esta pantalla no mide si el modelo acierta: mide si el sistema SABE a quién decidió y si alguien observó qué pasó después. Sin eso, el tablero de degradación puede estar verde sencillamente porque no le llega nada que medir.',
      },
      {
        id: 'tab-coverage',
        target: '[data-tutorial-id="quality-tab-coverage"]',
        title: 'Empieza por la cobertura',
        content:
          'La primera pestaña responde las dos preguntas de las que dependen las demás: cuántas decisiones identifican al solicitante y cuántas ventanas de observación vencidas cerró alguien.',
        requiredAction: 'click',
      },
      {
        id: 'coverage',
        target: '[data-tutorial-id="quality-coverage"]',
        title: 'Los dos ratios, siempre con su denominador',
        content:
          'Un 100 % sobre tres decisiones y un 100 % sobre veinte mil se ven idénticos si sólo se manda el porcentaje, así que debajo de cada uno va la cuenta real. Y un guion «—» en tono neutro significa que la medida no se pudo tomar: no es un cero.',
        tip: 'Los botones de 7, 30 y 90 días cambian la ventana. La cobertura es una alarma, no un informe mensual: mírala corta.',
        optional: true,
      },
      {
        id: 'tab-outcomes',
        target: '[data-tutorial-id="quality-tab-outcomes"]',
        title: 'De la alarma al trabajo',
        content:
          'La pestaña «Desenlaces» convierte «faltan observaciones» en una lista de casos con nombre. Es donde se arregla lo que la cobertura acaba de delatar.',
        requiredAction: 'click',
      },
      {
        id: 'pending',
        target: '[data-tutorial-id="quality-pending"]',
        title: 'La cola es el producto, no la carga',
        content:
          'Son las ventanas vencidas que nadie cerró, ordenadas por antigüedad. Que la lista esté COMPLETA a la vista es lo que hace lícito el registro manual: sobre una lista donde está todo no se puede elegir qué cargar, así que no aparece el sesgo de «lo que alguien se acordó de cargar».',
        tip: '«Indeterminado» es una respuesta de primera clase: cierra la ventana y distingue el caso que alguien miró del que se olvidó.',
        optional: true,
      },
      {
        id: 'upload',
        target: '[data-tutorial-id="quality-upload"]',
        title: 'Cargar en lote, validando antes',
        content:
          'El botón de escribir está apagado hasta que la validación pasa. Descubrir en la fila 4000 que una referencia no existe, con 3999 ya escritas sobre evidencia regulatoria, obligaría a borrar a mano justo la tabla que no se debe tocar a mano.',
        optional: true,
      },
      {
        id: 'tab-cutoff',
        target: '[data-tutorial-id="quality-tab-cutoff"]',
        title: 'Qué se aprobaría con otro umbral',
        content:
          'Con desenlaces observados ya se puede contestar la pregunta que siempre se hace a ojo: cuánto se ganaría y cuánto se perdería moviendo el punto de corte.',
        requiredAction: 'click',
      },
      {
        id: 'cutoff',
        target: '[data-tutorial-id="quality-cutoff"]',
        title: 'Champion contra challenger, por desenlace',
        content:
          'Las dos versiones se comparan por lo que pasó con sus decisiones, no por cuántas tomó cada una. Comparar volúmenes diría qué versión se usó más, que no es lo mismo que cuál decidió mejor.',
        optional: true,
      },
      {
        id: 'tab-vintages',
        target: '[data-tutorial-id="quality-tab-vintages"]',
        title: 'Y la conclusión mensual',
        content:
          'Las cosechas agrupan las decisiones por mes y siguen cómo envejecen. Es la lectura lenta: se mira una vez al mes y responde si la política de un periodo salió mejor o peor que la del anterior.',
        requiredAction: 'click',
      },
      {
        id: 'vintages',
        target: '[data-tutorial-id="quality-vintages"]',
        title: 'Por qué la celda más nueva no chilla',
        content:
          'La intensidad del color se atenúa con el número de observaciones. Sin eso, la cosecha más reciente —tres créditos, uno malo, 33 %— sería siempre la más alarmante de la matriz, y se leería como que la política de este mes es un desastre cuando lo único que hay es poca muestra.',
        optional: true,
      },
    ],
  ),
  'model-monitoring': t(
    'model-monitoring',
    'Monitoreo del modelo',
    'Vigilar si una versión desplegada se está degradando, y saber con qué se mide.',
    [
      {
        id: 'what',
        title: 'Tres medidas que sólo valen juntas',
        content:
          'Desempeño (¿sigue acertando?), estabilidad (¿le siguen llegando los mismos solicitantes?) e impacto adverso (¿trata igual a grupos comparables?). Un acierto estable sobre una población que cambió no es un buen modelo: es uno al que todavía no le ha tocado.',
        tip: 'Todo esto se apoya en desenlaces observados. Si «Calidad de la decisión» no está en verde, aquí no hay nada que leer.',
      },
      {
        id: 'controls',
        target: '[data-tutorial-id="monitoring-controls"]',
        title: 'Elige la versión y la ventana',
        content:
          'Se monitorea una versión concreta, no un algoritmo entero: dos versiones del mismo artefacto pueden comportarse de forma distinta, y mezclarlas esconde exactamente el cambio que se busca. Las fechas vacías significan «sin límite».',
        requiredAction: 'input',
        optional: true,
      },
      {
        id: 'comparison',
        target: '[data-tutorial-id="monitoring-comparison"]',
        title: 'Los dos campos que habilitan los otros análisis',
        content:
          'El desempeño se calcula siempre. La estabilidad sólo si indicas la variable a comparar, y el impacto adverso sólo si indicas un atributo ya agrupado en bandas. Vacíos, esos dos paneles simplemente no aparecen.',
        tip: 'Los atributos de sesgo son justo los que la ley prohíbe usar al DECIDIR. Aparecen aquí porque es la única forma de comprobar que no se están usando.',
        optional: true,
      },
      {
        id: 'reference',
        target: '[data-tutorial-id="monitoring-reference"]',
        title: 'La referencia se escribe, no se supone',
        content:
          'La estabilidad compara la ventana actual contra otra que tú declaras. Si el sistema eligiera por su cuenta «los últimos seis meses», el índice cambiaría cada día por razones que no son el modelo y nadie podría reproducir la cifra de ayer.',
        optional: true,
      },
      {
        id: 'run',
        target: '[data-tutorial-id="monitoring-run"]',
        title: 'Mide',
        content:
          'Se lanzan los análisis que tengan sus datos completos. El botón está apagado hasta que elijas una versión, que es el único campo imprescindible.',
        requiredAction: 'click',
        optional: true,
      },
      {
        id: 'performance',
        target: '[data-tutorial-id="monitoring-performance"]',
        title: 'El número que casi nadie mira',
        content:
          '«Falsos rechazos» son los rechazados que se habrían comportado bien. Es lo único que detecta un modelo demasiado restrictivo, porque sus malos no salen en ninguna estadística: nunca llegaron a entrar.',
        optional: true,
      },
      {
        id: 'stability',
        target: '[data-tutorial-id="monitoring-stability"]',
        title: 'PSI: cuánto se movió la población',
        content:
          'Por debajo de 0,10 la población es estable; hasta 0,25 se ha desplazado; por encima, es otra población. Las bandas van ordenadas por aportación al índice: la primera explica el desplazamiento y es la que hay que mirar antes de tocar ningún umbral.',
        optional: true,
      },
      {
        id: 'adverse',
        target: '[data-tutorial-id="monitoring-adverse"]',
        title: 'Una razón baja obliga a explicar, no concluye',
        content:
          'Un grupo por debajo de 0,8 frente al de referencia no es una conclusión de discriminación: obliga a buscar y dejar escrita la explicación de negocio. Los grupos con muestra pequeña se marcan aparte, porque con pocos casos la razón oscila sola.',
        optional: true,
      },
    ],
  ),
  'risk-governance': t(
    'risk-governance',
    'Gobierno del riesgo',
    'Las condiciones bajo las que se deja decidir al motor, reunidas donde se noten.',
    [
      {
        id: 'what',
        title: 'Ninguna decide; todas condicionan',
        content:
          'Las cinco pestañas comparten una propiedad incómoda: son las que se saltan cuando hay prisa. Un límite escondido en una regla del grafo desaparece al clonar el artefacto, una validación sin caducidad se vuelve un papel viejo y un permiso sin vigencia deja de ser un permiso.',
      },
      {
        id: 'tab-appetite',
        target: '[data-tutorial-id="risk-tab-appetite"]',
        title: 'Cuánto queda antes de topar',
        content:
          'El apetito de cartera es lo que impide que muchas decisiones individualmente buenas sumen una exposición que nadie aprobó.',
        requiredAction: 'click',
      },
      {
        id: 'appetite',
        target: '[data-tutorial-id="risk-appetite"]',
        title: 'Un límite que bloquea no se ve igual que uno que sólo mide',
        content:
          'La distinción es la más importante de la pestaña: verlos iguales haría creer que la cartera está protegida cuando lo único que hay es un número guardado. Lo normal es estrenar un límite midiendo y endurecerlo cuando se ve el consumo real.',
        optional: true,
      },
      {
        id: 'tab-calibration',
        target: '[data-tutorial-id="risk-tab-calibration"]',
        title: '¿La probabilidad que publica es la que ocurre?',
        content:
          'Un modelo puede ordenar bien a los solicitantes y aun así equivocarse en el número: decir 5 % donde pasa el 12 %. Ordenar y calibrar son dos cualidades distintas.',
        requiredAction: 'click',
      },
      {
        id: 'calibration',
        target: '[data-tutorial-id="risk-calibration"]',
        title: 'Sólo con desenlaces observados',
        content:
          'La curva se construye con lo que pasó de verdad, nunca con resultados inferidos por el propio modelo. Calibrar contra las predicciones de uno mismo devuelve siempre una calibración perfecta y no significa nada.',
        optional: true,
      },
      {
        id: 'tab-consent',
        target: '[data-tutorial-id="risk-tab-consent"]',
        title: 'Qué datos se pueden tratar hoy',
        content:
          'La licitud tiene fecha. Esta pestaña responde qué permisos de esa persona siguen vigentes y hasta cuándo, que es lo que decide si una decisión se puede tomar siquiera.',
        requiredAction: 'click',
      },
      {
        id: 'consent',
        target: '[data-tutorial-id="risk-consent"]',
        title: 'La referencia tampoco viaja en la URL',
        content:
          'Igual que en «Derechos del titular», la consulta va en el cuerpo de la petición. Un identificador de persona en una dirección acaba copiado en el registro de acceso, en el proxy y en la traza, donde ya no lo controla nadie.',
        optional: true,
      },
      {
        id: 'tab-reid',
        target: '[data-tutorial-id="risk-tab-reidentification"]',
        title: 'Del caso seudónimo a la persona',
        content:
          'A veces hay que saber de quién era un caso —una reclamación, una investigación de fraude—. Eso se pide, se justifica y lo aprueba otra persona.',
        requiredAction: 'click',
      },
      {
        id: 'reid',
        target: '[data-tutorial-id="risk-reidentification"]',
        title: 'Quien la pide no puede aprobarla',
        content:
          'Dos firmas y un motivo escrito. Es la misma separación de funciones que impide desplegar la propia versión, aplicada al dato más sensible que hay: la identidad detrás de un caso.',
        optional: true,
      },
      {
        id: 'tab-dossier',
        target: '[data-tutorial-id="risk-tab-dossier"]',
        title: 'El expediente del modelo',
        content:
          'Quién validó cada versión, con qué límites de uso y cuándo toca revisarla. Es lo primero que pide un supervisor y lo último que alguien se acuerda de escribir.',
        requiredAction: 'click',
      },
      {
        id: 'dossier',
        target: '[data-tutorial-id="risk-dossier"]',
        title: 'La firma la pone quien validó',
        content:
          'No quien escribió el modelo. Una validación firmada por su propio autor no es una validación, y una sin fecha de próxima revisión envejece sin que nadie se entere.',
        optional: true,
      },
    ],
  ),
};
