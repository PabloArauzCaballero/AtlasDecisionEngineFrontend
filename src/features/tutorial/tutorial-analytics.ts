/**
 * Punto de extensión para medir el aprendizaje.
 *
 * El progreso guardado dice DÓNDE se quedó cada persona, pero no cómo llegó
 * ahí: un recorrido que todo el mundo abandona en el paso 4 está mal escrito, y
 * eso no se ve en `lastStep` porque el registro sólo guarda el último valor.
 *
 * El motor emite estos eventos siempre; quién los escucha se inyecta desde el
 * armazón. Por omisión no se envía nada a ninguna parte: no hay endpoint de
 * analítica en el motor y fabricar tráfico de red que nadie pidió sería peor
 * que no medir. Para conectarlo, pasa tu propio adaptador a
 * `InteractiveTutorialProvider`.
 */
export type TutorialEvent =
  | { type: 'started'; tutorialId: string; version: number; from: number; repeat: boolean }
  | { type: 'step'; tutorialId: string; stepId: string; index: number; total: number }
  | { type: 'completed'; tutorialId: string; version: number }
  | { type: 'abandoned'; tutorialId: string; stepId: string; index: number; total: number };

export interface TutorialAnalytics {
  track: (event: TutorialEvent) => void;
}

/** Adaptador por omisión: no mide nada y nunca falla. */
export const noopAnalytics: TutorialAnalytics = { track: () => {} };

/**
 * Envuelve un adaptador para que un fallo suyo no tumbe el recorrido.
 *
 * Medir es accesorio; aprender no. Si el destino de la analítica revienta, la
 * persona tiene que poder seguir con su tutorial igual.
 */
export function safeAnalytics(analytics: TutorialAnalytics | undefined): TutorialAnalytics {
  if (!analytics) return noopAnalytics;
  return {
    track: (event) => {
      try {
        analytics.track(event);
      } catch {
        /* la analítica nunca puede romper el recorrido */
      }
    },
  };
}

/** Adaptador en memoria, para pruebas y para diagnosticar en una sesión. */
export function memoryAnalytics(): TutorialAnalytics & { events: TutorialEvent[] } {
  const events: TutorialEvent[] = [];
  return { events, track: (event) => events.push(event) };
}
