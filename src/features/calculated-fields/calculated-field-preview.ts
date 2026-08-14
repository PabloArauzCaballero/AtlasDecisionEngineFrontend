import { z } from 'zod';
import { toVersionPayload, type CalculatedFieldDraft } from './calculated-field.types';

/**
 * A dónde va un ensayo: a una versión ya guardada, o al borrador que se está escribiendo.
 *
 * Las dos rutas existen en el motor y hacen lo MISMO —mismo validador de contrato, mismo
 * ejecutor aislado, mismo generador del QA Lab—; lo único que cambia es de dónde sale la
 * definición. Por eso el panel de pruebas es uno solo: si hubiera dos, el que se usa antes
 * de crear acabaría siendo el pobre, que es justo cuando más falta hace.
 */
export type TryTarget =
  { kind: 'VERSION'; versionId: string } | { kind: 'DRAFT'; draft: CalculatedFieldDraft };

export interface ApiCall {
  path: string;
  body: Record<string, unknown>;
}

const BASE = '/v1/calculated-fields';

const versionPath = (versionId: string, action: string) =>
  `${BASE}/versions/${encodeURIComponent(versionId)}/${action}`;

/** Ejecutar con unas entradas concretas. */
export function tryCall(target: TryTarget, inputs: Record<string, unknown>): ApiCall {
  return target.kind === 'VERSION'
    ? { path: versionPath(target.versionId, 'try'), body: { inputs } }
    : { path: `${BASE}/preview/try`, body: { definition: toVersionPayload(target.draft), inputs } };
}

/**
 * Las cuatro clases de datos de prueba, con el mismo vocabulario que el simulador y el
 * QA Lab: las tres primeras describen la ENTRADA, `OUTCOMES` el FINAL.
 *
 * Que sean las mismas cuatro no es cosmético. Se podían generar veinte casos válidos que
 * terminaran siempre igual y dar por probado un cálculo cuya política de error no se había
 * ejecutado nunca; `OUTCOMES` pregunta justo por eso.
 */
export const SAMPLE_KINDS = ['OUTCOMES', 'VALID', 'BOUNDARY', 'INVALID'] as const;
export type SampleKind = (typeof SAMPLE_KINDS)[number];

export const KIND_LABELS: Readonly<Record<SampleKind, string>> = {
  OUTCOMES: 'Uno por cada tipo de salida',
  VALID: 'Válidos',
  BOUNDARY: 'En el límite del contrato',
  INVALID: 'Inválidos (deben rechazarse)',
};

export const KIND_HINTS: Readonly<Record<SampleKind, string>> = {
  OUTCOMES:
    'Genera de las tres clases, las ejecuta y agrupa por desenlace: enseña qué salidas del contrato se alcanzan y cuáles no.',
  VALID: 'Valores que cumplen el contrato de cada entrada.',
  BOUNDARY: 'Valores justo en el límite de las restricciones: es donde suelen aparecer los fallos.',
  INVALID: 'Valores que el contrato DEBE rechazar: comprueba que la política de error funciona.',
};

export interface SampleOptions {
  kind: Exclude<SampleKind, 'OUTCOMES'>;
  count: number;
  /** Vacía significa «dame una nueva»; el motor la devuelve para poder repetir el lote. */
  seed?: string;
}

/** Generar entradas de ejemplo, sin ejecutarlas. */
export function sampleCall(target: TryTarget, options: SampleOptions): ApiCall {
  const request = { kind: options.kind, count: options.count, seed: options.seed || undefined };
  return target.kind === 'VERSION'
    ? { path: versionPath(target.versionId, 'sample-inputs'), body: request }
    : {
        path: `${BASE}/preview/sample-inputs`,
        body: { ...request, definition: toVersionPayload(target.draft) },
      };
}

/** Ejecutar los casos de prueba declarados. */
export function testCall(target: TryTarget): ApiCall {
  return target.kind === 'VERSION'
    ? { path: versionPath(target.versionId, 'test'), body: {} }
    : { path: `${BASE}/preview/test`, body: { definition: toVersionPayload(target.draft) } };
}

export interface OutcomeOptions {
  /** Casos POR CLASE: se corren las tres, así que el total es el triple. */
  count: number;
  seed?: string;
}

/** Qué desenlaces del contrato de retorno alcanza de verdad. */
export function outcomesCall(target: TryTarget, options: OutcomeOptions): ApiCall {
  const request = { count: options.count, seed: options.seed || undefined };
  return target.kind === 'VERSION'
    ? { path: versionPath(target.versionId, 'outcomes'), body: request }
    : {
        path: `${BASE}/preview/outcomes`,
        body: { ...request, definition: toVersionPayload(target.draft) },
      };
}

export const sampleBatchSchema = z.object({
  seed: z.string(),
  kind: z.string(),
  cases: z.array(
    z.object({
      index: z.number(),
      kind: z.string(),
      mutation: z.string().optional(),
      input: z.record(z.unknown()),
      /** Entradas cuyo contrato no admite NINGÚN valor válido; hay que decirlo. */
      unsatisfiable: z.array(z.string()).optional(),
    }),
  ),
});

export type SampleBatch = z.infer<typeof sampleBatchSchema>;

export const outcomeReportSchema = z.object({
  seed: z.string(),
  countPerKind: z.number(),
  total: z.number(),
  declared: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      reason: z.string(),
      unreachable: z.string().optional(),
      covered: z.boolean(),
    }),
  ),
  undeclared: z.array(z.string()),
  uncovered: z.array(z.string()),
  cases: z.array(
    z.object({
      index: z.number(),
      kind: z.string(),
      mutation: z.string().optional(),
      input: z.record(z.unknown()),
      outcome: z.string(),
      value: z.unknown().optional(),
      error: z.string().optional(),
      durationMs: z.number(),
    }),
  ),
});

export type OutcomeReport = z.infer<typeof outcomeReportSchema>;

/**
 * Un borrador sin entradas o sin fórmula no se puede ensayar todavía.
 *
 * Se comprueba aquí y no dejando que el motor conteste 400: el mensaje del motor habla
 * del contrato, y lo que falta en este punto es más simple —todavía no hay nada que
 * ejecutar—. Decirlo antes ahorra una petición y un error que parece un fallo.
 */
export function draftBlocker(draft: CalculatedFieldDraft): string | null {
  if (!draft.inputs.length) return 'Declara al menos una entrada para poder probar el cálculo.';
  if (draft.implementationKind === 'OPERATION' && !draft.operation) {
    return 'Elige la operación principal para poder probarla.';
  }
  if (draft.implementationKind !== 'OPERATION' && !draft.sourceCode?.trim()) {
    return 'Escribe el código para poder probarlo.';
  }
  return null;
}
