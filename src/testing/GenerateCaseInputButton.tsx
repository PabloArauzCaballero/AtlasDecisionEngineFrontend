'use client';

import { useMutation } from '@tanstack/react-query';
import { Dices } from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import type { SampleKind } from './suite-types';

const sampleSchema = z.object({
  seed: z.string(),
  totalOutcomes: z.number().optional(),
  cases: z
    .array(
      z.object({
        input: z.record(z.unknown()),
        outcome: z.string().optional(),
        unresolved: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

type SampleCase = z.infer<typeof sampleSchema>['cases'][number];

interface Props {
  /** Versión que la suite prueba: de ahí sale el contrato, no de un ambiente. */
  artifactVersionId: string;
  /**
   * Clase de valores que corresponde al tipo de suite elegido. Se puede cambiar
   * a mano —a veces se quiere un caso límite dentro de una regresión—, pero el
   * valor por omisión lo decide el tipo, no la última elección del usuario.
   */
  defaultKind?: SampleKind;
  /** Por qué ese tipo se siembra así. Se enseña junto al selector. */
  kindReason?: string;
  onGenerated: (input: Record<string, unknown>) => void;
}

/**
 * Rellena la entrada de un caso con valores ficticios derivados del contrato de
 * la versión.
 *
 * El resultado esperado se deja a propósito en blanco: eso es lo que el analista está
 * afirmando y adivinarlo ejecutando el algoritmo convertiría la prueba en una tautología
 * —el caso pasaría siempre, incluso cuando el algoritmo esté mal—. Para comparar contra
 * la ejecución real están las corridas del QA Lab.
 */
export function GenerateCaseInputButton({
  artifactVersionId,
  defaultKind = 'VALID',
  kindReason,
  onGenerated,
}: Props) {
  const [kind, setKind] = useState<SampleKind>(defaultKind);
  const [seed, setSeed] = useState('');
  /** Con `OUTCOMES` el motor devuelve una entrada por desenlace: se eligen aquí. */
  const [outcomes, setOutcomes] = useState<SampleCase[]>([]);
  const [chosen, setChosen] = useState(0);

  // Cambiar el tipo de suite cambia lo que corresponde generar. Sin esto, elegir
  // «Generada del contrato» seguía sembrando casos cómodos porque el selector se
  // quedaba con el valor de antes.
  useEffect(() => setKind(defaultKind), [defaultKind]);

  const generate = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/qa-lab/versions/${encodeURIComponent(artifactVersionId)}/sample-inputs`, {
        method: 'POST',
        body: { kind, count: 1 },
        responseSchema: sampleSchema,
      }),
    onSuccess: (data) => {
      setSeed(data.seed);
      // Un caso de suite afirma UN resultado, así que se carga uno y se ofrecen los
      // demás: sin la lista, «un caso por desenlace» acabaría siendo siempre el primero.
      setOutcomes(kind === 'OUTCOMES' ? data.cases : []);
      setChosen(0);
      onGenerated(data.cases[0].input);
    },
  });

  function pickOutcome(index: number) {
    setChosen(index);
    onGenerated(outcomes[index].input);
  }

  return (
    <div className="sample-bar">
      <div className="sample-bar-actions">
        <label className="field sample-bar-kind">
          <span>Generar entrada de ejemplo</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as SampleKind)}>
            <option value="OUTCOMES">Una por cada resultado posible</option>
            <option value="VALID">Válida</option>
            <option value="BOUNDARY">En el límite del contrato</option>
            <option value="INVALID">Inválida (el caso debe rechazarse)</option>
          </select>
        </label>
        <button
          type="button"
          className="button"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          <Dices size={16} /> {generate.isPending ? 'Generando…' : 'Generar entrada'}
        </button>
      </div>
      {kindReason ? <small className="field-hint">{kindReason}</small> : null}
      {outcomes.length ? (
        <div className="sample-bar-cases" role="group" aria-label="Resultados que puede tomar">
          {outcomes.map((sample, index) => (
            <button
              key={sample.outcome ?? index}
              type="button"
              className="sample-case-chip"
              aria-pressed={index === chosen}
              onClick={() => pickOutcome(index)}
            >
              {sample.outcome ?? `Resultado ${index + 1}`}
              {sample.unresolved?.length ? ' ⚠' : ''}
            </button>
          ))}
        </div>
      ) : null}
      {generate.isError ? <Alert tone="error">{errorMessage(generate.error)}</Alert> : null}
      {seed && !generate.isError ? (
        <small className="field-hint">
          Entrada generada del contrato de la versión · semilla {seed}. El resultado esperado lo
          decides tú: es lo que la prueba afirma.
        </small>
      ) : null}
      {outcomes[chosen]?.unresolved?.length ? (
        <Alert tone="warning">
          Este resultado depende de valores que calcula el propio grafo, así que la entrada no
          garantiza llegar a él: {outcomes[chosen].unresolved?.join('; ')}
        </Alert>
      ) : null}
    </div>
  );
}
