import type { TutorialRegistry } from './tutorial.types';

/** "El lab" — the quality + operation tools where artifacts are exercised. */
export const labTutorials: TutorialRegistry = {
  '/test-suites': {
    eyebrow: 'Laboratorio · Calidad',
    title: 'Suites de Prueba',
    intro: 'Validan de forma determinista que una versión de artefacto decide como esperas.',
    steps: [
      {
        title: 'Cargar una versión',
        body: 'Elige el artefacto y su versión y pulsa «Cargar suites» para ver las suites asociadas.',
      },
      {
        title: 'Crear una suite',
        body: '«Crear suite» crea una suite con un caso inicial: una entrada y su resultado esperado.',
      },
      {
        title: 'Compila antes de probar',
        body: 'Una suite solo se ejecuta si la versión del artefacto está compilada. Si no lo está, al ejecutarla aparece un aviso «Esta versión todavía no tiene un artefacto compilado»: abre «Validar y compilar» de esa versión, compílala y vuelve a ejecutar la suite.',
        tip: 'El portal te muestra un aviso que lleva a la pantalla de compilar cuando falta ese paso.',
      },
      {
        title: 'Ejecutar y bloquear',
        body: 'El botón ▶ («Ejecutar suite») de cada fila la pone en cola; un procesador automático la ejecuta y muestra resultado y cobertura. Una suite obligatoria impide publicar la versión si falla.',
        tip: 'Pulsa «Ejecutar todas» para validar toda la versión antes de solicitar su aprobación.',
      },
    ],
  },
  '/test-cases': {
    eyebrow: 'Laboratorio · Calidad',
    title: 'Casos de Prueba',
    intro: 'Un caso fija una entrada concreta y el resultado esperado para un artefacto.',
    steps: [
      {
        title: 'Elegir la suite',
        body: 'Selecciona la suite para ver y gestionar los casos que contiene.',
      },
      {
        title: 'Crear o importar',
        body: 'Crea casos manualmente, o importa muchos de una vez desde una hoja de cálculo guardada como CSV.',
      },
      {
        title: 'Ejecutar y comparar',
        body: 'Al ejecutar, el resultado real se compara contra el esperado; cualquier diferencia marca el caso como fallo.',
      },
    ],
  },
  '/graph-coverage': {
    eyebrow: 'Laboratorio · Calidad',
    title: 'Cobertura de Grafo',
    intro: 'Muestra qué nodos y aristas del grafo ejercitaron tus pruebas.',
    steps: [
      {
        title: 'Leer la cobertura',
        body: 'Cada barra indica el porcentaje de nodos o aristas cubiertos por la última ejecución de pruebas.',
      },
      {
        title: 'Cerrar los huecos',
        body: 'Los nodos sin cubrir son rutas de decisión que ninguna prueba recorre. Añade casos que las alcancen para subir la cobertura.',
      },
    ],
  },
  '/simulator': {
    eyebrow: 'Laboratorio · Operación',
    title: 'Simulador de Decisión',
    intro: 'Ejecuta una decisión de prueba con tus entradas, sin afectar producción.',
    steps: [
      {
        title: 'Elegir artefacto y ambiente',
        body: 'Selecciona el artefacto y un ambiente no productivo. El simulador nunca ejecuta contra producción.',
      },
      {
        title: 'Definir entradas',
        body: 'Completa las variables de entrada del contrato del artefacto; el editor valida su forma antes de ejecutar.',
      },
      {
        title: 'Ejecutar y leer el resultado',
        body: 'Pulsa «Ejecutar» para ver el resultado, los motivos y el recorrido de nodos recorridos.',
        tip: 'El recorrido te dice exactamente por qué el grafo tomó una ruta: úsalo para encontrar errores.',
      },
    ],
  },
  '/manual-reviews': {
    eyebrow: 'Laboratorio · Operación',
    title: 'Cola de Revisión Manual',
    intro: 'Reúne los casos que una regla derivó a decisión humana controlada.',
    steps: [
      {
        title: 'La cola',
        body: 'Cada fila es un caso pendiente con su prioridad, motivo de derivación y plazo restante.',
      },
      {
        title: 'Resolver un caso',
        body: 'Abre el detalle para revisar el contexto y la evidencia, y registrar una resolución que queda auditada.',
      },
    ],
  },
};
