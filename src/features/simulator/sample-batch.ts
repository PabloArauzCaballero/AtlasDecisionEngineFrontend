import { z } from 'zod';
import type { ImportedCase } from './sample-import';

/**
 * Qué pide el botón «Generar valores» y cómo se lee lo que contesta el motor.
 *
 * Las tres clases históricas describen la ENTRADA: si respeta el contrato, si roza el
 * límite o si debe rechazarse. Con ellas se podían generar veinte casos válidos que
 * recorrieran siempre la misma rama y dar por probado un algoritmo del que la mitad de
 * las decisiones no se había ejecutado nunca. `OUTCOMES` pregunta por el otro extremo:
 * un caso por cada final del grafo —aprobado, revisión, rechazo, cada resultado del
 * contrato de salida—, con la entrada construida hacia atrás desde ese final.
 */
export const SAMPLE_KINDS = ['OUTCOMES', 'VALID', 'BOUNDARY', 'INVALID'] as const;
export type SampleKind = (typeof SAMPLE_KINDS)[number];

export const KIND_OPTIONS: Readonly<Record<SampleKind, string>> = {
  OUTCOMES: 'Uno por cada resultado posible',
  VALID: 'Válidos',
  BOUNDARY: 'En el límite del contrato',
  INVALID: 'Inválidos (deben rechazarse)',
};

const KIND_SUMMARY: Readonly<Record<SampleKind, string>> = {
  OUTCOMES: 'casos, uno por cada desenlace del algoritmo',
  VALID: 'casos válidos',
  BOUNDARY: 'casos en el límite',
  INVALID: 'casos inválidos',
};

export const sampleInputsSchema = z.object({
  seed: z.string(),
  kind: z.string(),
  totalOutcomes: z.number().optional(),
  cases: z.array(
    z.object({
      index: z.number(),
      kind: z.string(),
      mutation: z.string().optional(),
      outcome: z.string().optional(),
      nodeKey: z.string().optional(),
      path: z.array(z.string()).optional(),
      unresolved: z.array(z.string()).optional(),
      input: z.record(z.unknown()),
    }),
  ),
});

export type SampleBatch = z.infer<typeof sampleInputsSchema>;

export interface BatchReading {
  cases: ImportedCase[];
  text: string;
  tone: 'info' | 'warning';
}

/**
 * Traduce el lote a lo que ve el analista.
 *
 * Dos cosas se dicen siempre, y las dos son avisos de cobertura incompleta: cuando el
 * grafo tiene más desenlaces que casos devueltos, y cuando una rama depende de un valor
 * que el propio grafo calcula y por tanto la entrada no puede forzar. Callarlas dejaría
 * una tanda que PARECE cubrirlo todo.
 */
export function readBatch(kind: SampleKind, batch: SampleBatch): BatchReading {
  const cases = batch.cases.map((generated) => ({
    label: caseLabel(generated),
    input: generated.input,
  }));
  const parts = [`${cases.length} ${KIND_SUMMARY[kind]}`];
  let tone: 'info' | 'warning' = 'info';

  if (kind === 'OUTCOMES') {
    const total = batch.totalOutcomes ?? cases.length;
    if (total > cases.length) {
      parts.push(`el algoritmo tiene ${total}: faltan ${total - cases.length} por cubrir`);
      tone = 'warning';
    }
    const unresolved = batch.cases.flatMap((generated) => generated.unresolved ?? []);
    if (unresolved.length) {
      parts.push(
        `${unresolved.length} condición(es) dependen de valores que calcula el propio grafo, así que esas ramas no están garantizadas: ${unresolved.join('; ')}`,
      );
      tone = 'warning';
    }
    if (!cases.length) {
      return {
        cases,
        tone: 'warning',
        text: 'Este artefacto no expone desenlaces recorribles desde su grafo desplegado. Genera valores válidos y revisa el resultado a mano.',
      };
    }
  }

  parts.push(`semilla ${batch.seed}`);
  return { cases, tone, text: parts.join(' · ') };
}

/** El rótulo del chip: el desenlace manda sobre el número, porque es lo que se busca. */
function caseLabel(generated: SampleBatch['cases'][number]): string {
  const suffix = generated.outcome ?? generated.mutation;
  return `Caso ${generated.index + 1}${suffix ? ` · ${suffix}` : ''}`;
}
