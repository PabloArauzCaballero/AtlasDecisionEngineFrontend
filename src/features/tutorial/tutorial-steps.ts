export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** Route to navigate to before locating `targetSelector`. Omit to stay put. */
  route?: string;
  /** CSS selector (matches a `data-tutorial-id` attribute) to spotlight. Omit for
   *  a centered, un-anchored step (e.g. the welcome/closing screens). */
  targetSelector?: string;
}

/**
 * Fase 4 — interactive tutorial. Steps 2-3 present the algorithm the mission brief
 * names as the reference example (age, income, hasActiveDebt -> riskLevel,
 * explanation) as worked, clearly-labeled sample data — not a live call, since no
 * artifact with exactly this shape is guaranteed to be deployed in every
 * environment. Steps 4+ hand off to the real, always-available Simulator page so
 * the walkthrough ends with a genuine hands-on action, not just reading.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenido a Atlas Decision Engine',
    body: 'Este recorrido te muestra, en unos pocos pasos, cómo se prueba un árbol de decisión antes de publicarlo. Puedes salir en cualquier momento y reiniciarlo luego desde el botón de ayuda.',
  },
  {
    id: 'sample-algorithm',
    title: 'Datos de prueba (ejemplo ilustrativo)',
    body: 'Ejemplo de referencia — no son datos reales: un algoritmo con entradas age, income y hasActiveDebt produce las salidas riskLevel y explanation. age=35, income=4200, hasActiveDebt=false → riskLevel="LOW", explanation="Ingresos estables y sin deuda activa".',
  },
  {
    id: 'sample-algorithm-negative',
    title: 'Mismo ejemplo, otro caso',
    body: 'Datos de prueba: age=22, income=1200, hasActiveDebt=true → riskLevel="HIGH", explanation="Ingresos bajos combinados con deuda activa". Así es como un árbol de decisión documenta el porqué de cada resultado.',
  },
  {
    id: 'nav-simulator',
    title: 'Ahora, pruébalo tú',
    body: 'Este es el enlace al simulador. Haz clic en "Siguiente" y te llevaremos ahí — desde ahí puedes ejecutar una decisión real contra cualquier artefacto desplegado.',
    route: '/simulator',
    targetSelector: '[data-tutorial-id="nav-simulator"]',
  },
  {
    id: 'simulator-form',
    title: 'Configura una decisión de prueba',
    body: 'Indica el código del artefacto y el ambiente (usa SANDBOX para no afectar producción), y edita las variables de entrada en formato JSON.',
    targetSelector: '[data-tutorial-id="simulator-form"]',
  },
  {
    id: 'simulator-submit',
    title: 'Ejecuta la simulación',
    body: 'Al enviar, el motor evalúa el árbol de decisión con esos valores y te muestra el resultado explicado — outcome, razones y la ruta que siguió por el grafo.',
    targetSelector: '[data-tutorial-id="simulator-submit"]',
  },
  {
    id: 'done',
    title: 'Eso es todo',
    body: 'Puedes reiniciar este recorrido cuando quieras desde el botón de ayuda en la barra superior.',
  },
];
