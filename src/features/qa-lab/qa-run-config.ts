import type { UnknownRecord } from '../../utils/records';

/**
 * La configuración de una corrida del QA Lab y cómo viaja al motor.
 *
 * No hay «ambiente»: el QA Lab evalúa la versión compilada dentro del propio motor, sin
 * persistir ninguna ejecución. El selector DEV/TEST/STAGING que había sólo se archivaba y no
 * cambiaba nada, así que se quitó.
 */
export interface QaRunConfig {
  caseCount: number;
  seed: string;
  validPercent: number;
  boundaryPercent: number;
  invalidPercent: number;
  concurrency: number;
  timeoutMs: number;
  stopOnFirstFailure: boolean;
  checkDeterminism: boolean;
  /** Un caso por cada desenlace del grafo, además de los de la mezcla. */
  coverOutcomes: boolean;
  /** Pesos relativos por desenlace para repartir la porción válida. Vacío = sin reparto. */
  outcomeWeights: Record<string, number>;
  /**
   * Distribuciones por variable. No se editan en esta pantalla, pero una corrida reproducida
   * las trae archivadas y tienen que volver a mandarse: sin ellas el lote sería otro.
   */
  distributions: UnknownRecord[];
}

export const DEFAULT_QA_CONFIG: QaRunConfig = {
  caseCount: 200,
  seed: '',
  validPercent: 60,
  boundaryPercent: 15,
  invalidPercent: 25,
  concurrency: 8,
  timeoutMs: 120_000,
  stopOnFirstFailure: false,
  checkDeterminism: false,
  coverOutcomes: true,
  outcomeWeights: {},
  distributions: [],
};

/** El cuerpo del `POST /v1/qa-lab/versions/:id/runs`. */
export function toRunBody(config: QaRunConfig): UnknownRecord {
  return {
    caseCount: config.caseCount,
    seed: config.seed.trim() || undefined,
    validPercent: config.validPercent,
    boundaryPercent: config.boundaryPercent,
    invalidPercent: config.invalidPercent,
    concurrency: config.concurrency,
    timeoutMs: config.timeoutMs,
    stopOnFirstFailure: config.stopOnFirstFailure,
    checkDeterminism: config.checkDeterminism,
    coverOutcomes: config.coverOutcomes,
    // Vacío se OMITE: mandar {} haría que el motor entendiera «reparte» y rechazara la
    // corrida por no llevar ningún peso mayor que cero.
    outcomeWeights: Object.keys(config.outcomeWeights).length ? config.outcomeWeights : undefined,
    distributions: config.distributions.length ? config.distributions : undefined,
  };
}
