/**
 * Un ejemplo concreto por pantalla, en lenguaje de calle.
 *
 * La explicación de negocio dice PARA QUÉ sirve una vista; esto dice qué harías
 * tú, hoy, con un caso real. Va en archivo aparte de `view-explanations.ts` para
 * que ese catálogo no crezca sin límite y para poder revisar la redacción de los
 * ejemplos de una vez, sin leer el resto.
 *
 * Regla al escribirlos: nombres de negocio (ingreso, edad, mora), nunca nombres
 * de tabla; y un caso completo, no una definición.
 */
export const viewExamples: Readonly<Record<string, string>> = {
  variables:
    'Das de alta «ingreso_mensual» como número entre 0 y 100.000, marcas que es dato personal y dices que llega en la petición. A partir de ahí cualquier algoritmo puede compararlo, y si alguien manda un texto, el motor lo rechaza solo.',
  'reason-codes':
    'Creas «DTI_TOO_HIGH» con el mensaje público «Tu nivel de deuda supera lo permitido». Cuando una decisión rechaza por ese motivo, el cliente ve esa frase y el auditor ve el código: la misma causa contada dos veces, para dos públicos.',
  'calculated-fields':
    'Defines «capacidad_de_pago = ingreso − gastos» una sola vez. Tres algoritmos distintos la usan; el día que cambie la fórmula, cambia en un sitio y con una versión nueva que puedes probar antes de publicar.',
  libraries:
    'Habilitas la librería «math» para JavaScript. A partir de ahí un campo calculado puede escribir `math.round(...)` sin importar nada; lo que no esté en esta lista, simplemente no existe dentro del código.',
  artifacts:
    'Buscas «BNPL» y ves que la versión 2 está desplegada en producción y la 3 en borrador. Desde ahí abres la 3, la editas y la mandas a revisión sin tocar lo que hoy decide de verdad.',
  algorithms:
    'Ves que «Scoring de crédito» va por la versión 4 y que la 3 sigue activa en TEST. Comparas ambas antes de decidir si promueves la nueva.',
  'graph-editor':
    'Dibujas: Inicio → ¿la edad es mayor o igual a 18? → si no, Rechazar con motivo «no cumple la edad mínima»; si sí, seguir al cálculo de capacidad de pago. Sin escribir una línea de código.',
  'code-import':
    'Pegas un script de Python que ya usabas en un cuaderno y el motor lo convierte en un árbol de nodos, señalando lo que no puede traducir. Sirve para migrar lógica que hoy vive fuera.',
  'test-suites':
    'Agrupas los ocho casos de «originación de crédito» en una suite y la marcas como bloqueante: si uno falla, esa versión no se publica.',
  'test-cases':
    'Escribes el caso «solicitante de 16 años» con su entrada y el resultado que esperas: RECHAZADO con el motivo de edad. Si algún día el algoritmo deja de rechazarlo, la prueba lo delata.',
  'coverage-matrix':
    'Descubres que ninguna prueba cubre la rama «ingreso muy alto y mora reciente». Es exactamente el caso raro que revienta en producción.',
  'graph-coverage':
    'Ves que dos nodos del árbol nunca se ejecutaron en las pruebas: o sobran, o falta un caso que pase por ellos.',
  reviews:
    'Mandas la versión 3 a revisión. Un compañero con permiso de riesgo la aprueba o la devuelve con comentarios; tú no puedes aprobar la tuya.',
  environments:
    'Compruebas qué versión está activa en DEV, en TEST, en STAGING y en producción. Cuatro respuestas distintas para la misma pregunta, y aquí se ven juntas.',
  'platform-health':
    'De un vistazo: el motor responde, la cola de trabajos está vacía y la última decisión tardó 60 ms. Si algo va mal, se ve aquí antes de que lo reporte un cliente.',
  executions:
    'Un cliente reclama que le rechazaron. Buscas su solicitud, abres la traza y ves el camino exacto que siguió la decisión y con qué datos.',
  'audit-events':
    'Alguien cambió una regla el martes. Aquí queda quién fue, cuándo y qué cambió exactamente, sin poder borrarlo.',
  'decision-quality':
    'El tablero dice que el modelo va bien, pero aquí ves que sólo el 12 % de las decisiones de la última semana identifica al solicitante. No es que acierte: es que casi nada se puede medir.',
  'model-monitoring':
    'La versión 4 lleva tres meses aprobando igual que siempre, pero el índice de estabilidad de «ingreso mensual» subió a 0,31: ya no le llega la misma gente, y el corte que era bueno dejó de serlo.',
  'risk-governance':
    'Estrenas un límite de concentración por sector en modo «sólo mide». A las tres semanas ves que va por el 92 % y lo pones a bloquear, antes de que topar sea una sorpresa de fin de mes.',
  'data-subject-requests':
    'Alguien llama preguntando por qué le negaron el crédito. Registras un acceso con su referencia y salen todas las decisiones sobre esa persona con los motivos que se le pueden leer — y queda constancia de que alguien las consultó.',
  deployments:
    'Publicas la versión 3 en TEST, la pruebas, y si algo va mal vuelves a la 2 con un clic. El historial guarda ambas cosas.',
  objectives:
    'Declaras que quieres bajar la mora al 3 % sin perder más del 5 % de aprobaciones. Luego contrastas si los cambios te acercan o te alejan.',
  'manual-reviews':
    'Una solicitud dudosa cae en tu bandeja con el motivo por el que llegó. La resuelves a mano y esa decisión queda registrada igual que las automáticas.',
  simulator:
    'Antes de publicar, pruebas un solicitante inventado y ves qué decidiría. Si el resultado te sorprende, todavía estás a tiempo.',
  'live-execution':
    'Lanzas una decisión y ves el recorrido dibujándose paso a paso, con el valor de cada variable al pasar por cada nodo. Es depurar mirando, no leyendo registros.',
  'qa-lab':
    'Pides doscientos casos generados del contrato y el laboratorio encuentra la combinación que rompe el algoritmo, reducida al mínimo que la reproduce.',
  search:
    'Escribes «ingreso» y encuentras la variable, los algoritmos que la usan y las decisiones donde apareció.',
};
