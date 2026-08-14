/**
 * Topes de vida de una sesión — NIST SP 800-63B, AAL2 (§7.2).
 *
 * La norma pide DOS, y son distintos:
 *
 * - **Inactividad (30 min).** Si nadie toca el portal durante media hora, la
 *   sesión se cierra. Protege el caso real: el equipo desatendido de quien se
 *   fue a comer, con un expediente de crédito abierto en pantalla.
 * - **Absoluto (12 h).** Aunque se use sin parar, a las doce horas hay que
 *   volver a autenticarse. Protege del otro caso: una sesión robada que el
 *   atacante mantiene viva justamente moviéndose.
 *
 * Sólo con el primero, una sesión activa dura para siempre; sólo con el segundo,
 * una pestaña olvidada aguanta doce horas. Por eso van los dos.
 *
 * Lo que había era lo contrario de esto: el temporizador de `AuthProvider`
 * renovaba el token en `exp - 60 s` sin mirar si había actividad, así que una
 * pestaña abierta y olvidada se mantenía autenticada indefinidamente. El propio
 * portal tenía escrito desde el principio el mensaje «Tu sesión anterior expiró
 * por inactividad» (`login-errors.ts`), describiendo algo que el cliente no
 * podía provocar.
 *
 * Esto NO sustituye al control del servidor: el motor decide la vida real del
 * refresh token. Es la mitad que le toca al navegador, que es donde queda la
 * pantalla encendida.
 */

/** Media hora sin interacción. */
export const IDLE_LIMIT_MS = 30 * 60_000;

/** Doce horas desde la autenticación, se use o no. */
export const ABSOLUTE_LIMIT_MS = 12 * 60 * 60_000;

/**
 * Cuánto antes de cerrar se avisa.
 *
 * Cerrar sin avisar tira el trabajo a medias de quien estaba escribiendo un
 * comentario de resolución, y le enseña a no fiarse del portal. Dos minutos dan
 * tiempo a pulsar una tecla —que ya cuenta como actividad— o a guardar.
 */
export const WARNING_BEFORE_MS = 2 * 60_000;

/**
 * Eventos que cuentan como «hay alguien delante».
 *
 * Deliberadamente NO incluye `mousemove` ni `scroll`: un ratón rozado por un
 * cable o una página que se desplaza sola por una animación mantendrían viva
 * una sesión que nadie está usando, y entonces el tope no protege de nada.
 * `visibilitychange` sí cuenta: volver a la pestaña es una intención.
 */
export const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'visibilitychange',
] as const;

export interface SessionDeadlines {
  /** Cuándo cierra por inactividad. */
  idleAt: number;
  /** Cuándo cierra por antigüedad, pase lo que pase. */
  absoluteAt: number;
}

export function deadlinesFrom(startedAt: number, lastActivityAt: number): SessionDeadlines {
  return {
    idleAt: lastActivityAt + IDLE_LIMIT_MS,
    absoluteAt: startedAt + ABSOLUTE_LIMIT_MS,
  };
}

/** El plazo que venza antes manda: los dos topes son techos, no alternativas. */
export function nextDeadline(deadlines: SessionDeadlines): number {
  return Math.min(deadlines.idleAt, deadlines.absoluteAt);
}

/**
 * Milisegundos hasta que haya que actuar, nunca negativos.
 *
 * `setTimeout` con un retraso negativo dispara de inmediato, lo que en un bucle
 * de re-armado se convierte en una tormenta de temporizadores.
 */
export function msUntil(instant: number, now: number): number {
  return Math.max(0, instant - now);
}
