import { asRecord, asRows } from '../../utils/records';
import type { WorkerRun } from './worker-types';

/**
 * Lo que la consola de extractos le dice, de forma PERSISTENTE, a quien subió un PDF.
 *
 * Pablo (2026-10-15): «no está dando la consola con uno que le subo». Medido en TEST: el motor
 * deduplica por la huella del archivo y no crea otra ejecución para un PDF que ya tiene; devolvía la
 * anterior —en revisión porque no reconoció la entidad, o cerrada sin movimientos— y la consola sólo
 * anunciaba «Extracto encolado» con un aviso que se va solo. Debajo no aparecía nada y no había forma
 * de saber por qué. Aquí se decide el mensaje que se queda en la pantalla: qué pasó y qué hacer.
 *
 * `null` cuando no hay nada que añadir: la ejecución avanza o ya trae sus movimientos.
 */
export interface ConsoleOutcome {
  tone: 'info' | 'warning';
  title: string;
  body: string;
  /** Adónde ir a resolverlo, dentro del mismo procesador. */
  links: { label: string; href: string }[];
}

const REVISION = {
  label: 'Abrir la revisión de extractos',
  href: '/workers/bank-statement?vista=revision',
};
const ENTIDADES = {
  label: 'Ver el padrón de entidades',
  href: '/workers/bank-statement?vista=entidades',
};

/** Si el resultado trae movimientos que pintar. */
export function hasMovements(run: Pick<WorkerRun, 'result'>): boolean {
  return asRows(asRecord(run.result).transactions).length > 0;
}

export function consoleOutcome(run: WorkerRun, deduplicated: boolean): ConsoleOutcome | null {
  const repetido = deduplicated
    ? `Este PDF ya estaba en el motor (ejecución ${run.requestId}, recibida antes): no se vuelve a procesar, se muestra la ejecución que ya existe. `
    : '';
  const enRevision = run.status === 'PENDING_REVIEW' || run.status === 'IN_REVIEW';

  if (enRevision) {
    const entidad = run.reviewReason === 'UNKNOWN_BANK';
    return {
      tone: 'warning',
      title: entidad
        ? 'Detenido: no se reconoció la entidad que emitió el extracto'
        : 'Detenido para revisión',
      body:
        repetido +
        (entidad
          ? 'El motor sólo procesa extractos de entidades que están en el padrón. Si el padrón está vacío o no incluye este banco, el extracto espera a una persona. Cárgalo en «Entidades financieras» o resuélvelo en la revisión.'
          : 'Una persona tiene que decidirlo en la revisión de extractos; mientras tanto no hay movimientos que enseñar aquí.') +
        (hasMovements(run) ? ' Lo que sí se pudo leer está abajo.' : ''),
      links: entidad ? [REVISION, ENTIDADES] : [REVISION],
    };
  }

  const terminadoBien = run.status === 'SUCCEEDED' || run.status === 'SUCCEEDED_WITH_WARNINGS';
  if (terminadoBien && !hasMovements(run)) {
    return {
      tone: 'warning',
      title: 'Terminó sin movimientos',
      body:
        repetido +
        'La ejecución está cerrada pero no trae movimientos que analizar: se resolvió sin leer el extracto (por ejemplo, desde la revisión, antes de que la entidad estuviera en el padrón). Para analizarlo, resuélvelo de nuevo desde la revisión con la entidad cargada.',
      links: [REVISION, ENTIDADES],
    };
  }

  if (deduplicated) {
    return {
      tone: 'info',
      title: 'Este PDF ya estaba en el motor',
      body: repetido.trim(),
      links: [],
    };
  }
  return null;
}
