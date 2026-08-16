import { env } from '../../config/env';
import type { WorkerRunStatus } from './worker-types';

/**
 * Cuándo la pantalla DEJA DE ESPERAR una glosa, y con qué motivo.
 *
 * **El principio.** Quien clasifica un extracto no debería sufrir la latencia
 * interna del motor. Si una glosa no se resuelve en un plazo razonable, lo
 * correcto no es tener la fila girando indefinidamente: es soltarla, decir que
 * quedó en revisión y devolverle la pantalla a quien la estaba usando. El motor
 * sigue trabajando —nada se cancela— y el término acaba en la bandeja de
 * pendientes con su motivo escrito.
 *
 * **Esto NO es un error, y por eso tiene fase propia.** Colapsarlo con «No se
 * pudo» afirmaría que la clasificación falló, cuando lo único que se sabe es que
 * todavía no ha terminado. La diferencia importa porque se actúa distinto: un
 * fallo se reintenta, una revisión se atiende.
 *
 * **El reloj arranca cuando la ejecución EMPIEZA, no cuando se encola.** Es la
 * decisión que evita la avalancha falsa: un extracto de seiscientas glosas las
 * encola todas a la vez y las últimas esperan su turno muchos segundos sin que
 * nada vaya mal. Medir desde el encolado mandaría media tabla a revisión por
 * estar en la cola, que es rendimiento del sistema y no ambigüedad de la glosa —y
 * llenaría la bandeja de trabajo con casos que nadie tiene que revisar.
 */

/** Vocabulario cerrado, espejo de `domain/review-reason.ts` en el motor. */
export const MOTIVO_REVISION = {
  TIMEOUT: 'TIMEOUT',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
} as const;

export type MotivoRevision = (typeof MOTIVO_REVISION)[keyof typeof MOTIVO_REVISION];

export const TEXTO_MOTIVO: Record<MotivoRevision, string> = {
  TIMEOUT: 'El motor tardó más de lo previsto y la glosa quedó en revisión.',
  LOW_CONFIDENCE: 'El motor no alcanzó confianza suficiente y la glosa quedó en revisión.',
};

/**
 * El plazo, en milisegundos, que la pantalla espera por una glosa YA EN CURSO.
 *
 * Se lee de la configuración y no se escribe aquí a mano: cuánto es «demasiado»
 * depende de la máquina, del proveedor y de la carga, y eso lo decide quien
 * opera el portal. El valor de serie es un punto de partida razonable —por
 * encima de veinte segundos mirando una fila girar, esperar ya no paga— y debe
 * ajustarse midiendo la latencia real; no es un número calibrado.
 */
export const PRESUPUESTO_MS = env.glossReviewTimeoutMs;

/**
 * Marca de tiempo desde la que cuenta el plazo de una ejecución.
 *
 * `null` mientras siga en cola: ahí no hay nada que cronometrar todavía.
 */
export function inicioDelPlazo(
  status: WorkerRunStatus,
  ahora: number,
  previo: number | null,
): number | null {
  if (previo !== null) return previo;
  return status === 'QUEUED' ? null : ahora;
}

/** Si una ejecución en curso ya agotó su plazo. */
export function plazoAgotado(
  inicio: number | null,
  ahora: number,
  presupuestoMs: number = PRESUPUESTO_MS,
): boolean {
  return inicio !== null && ahora - inicio >= presupuestoMs;
}

/**
 * El aviso que se enseña cuando alguna glosa se fue a revisión.
 *
 * En tono informativo y NUNCA en rojo: no ocurrió ningún fallo. El texto dice
 * las tres cosas que quien lo lee necesita —qué pasó, dónde queda el trabajo y
 * que puede seguir— porque un aviso que sólo dice «enviado a revisión» obliga a
 * ir a buscar qué significa eso.
 */
export function avisoDeRevision(cuantas: number): { title: string; description: string } {
  const plural = cuantas === 1 ? '' : 's';
  return {
    title: `${String(cuantas)} glosa${plural} enviada${plural} a revisión`,
    description:
      'El procesamiento está tomando más tiempo de lo esperado. El motor sigue trabajando y ' +
      'el término aparecerá en «Pendientes» con su motivo. Puedes continuar con el resto.',
  };
}
