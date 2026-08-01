'use client';

import { useMutation } from '@tanstack/react-query';
import { Dices } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';

const sampleSchema = z.object({
  seed: z.string(),
  cases: z.array(z.object({ input: z.record(z.unknown()) })).min(1),
});

type Kind = 'VALID' | 'BOUNDARY' | 'INVALID';

interface Props {
  /** Versión que la suite prueba: de ahí sale el contrato, no de un ambiente. */
  artifactVersionId: string;
  onGenerated: (input: Record<string, unknown>) => void;
}

/**
 * Rellena la entrada de un caso con valores derivados del contrato de la versión.
 *
 * El resultado esperado se deja a propósito en blanco: eso es lo que el analista está
 * afirmando y adivinarlo ejecutando el algoritmo convertiría la prueba en una tautología
 * —el caso pasaría siempre, incluso cuando el algoritmo esté mal—. Para comparar contra
 * la ejecución real están las corridas del QA Lab.
 */
export function GenerateCaseInputButton({ artifactVersionId, onGenerated }: Props) {
  const [kind, setKind] = useState<Kind>('VALID');
  const [seed, setSeed] = useState('');

  const generate = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/qa-lab/versions/${encodeURIComponent(artifactVersionId)}/sample-inputs`, {
        method: 'POST',
        body: { kind, count: 1 },
        responseSchema: sampleSchema,
      }),
    onSuccess: (data) => {
      setSeed(data.seed);
      onGenerated(data.cases[0].input);
    },
  });

  return (
    <div className="sample-bar">
      <div className="sample-bar-actions">
        <label className="field sample-bar-kind">
          <span>Generar entrada de ejemplo</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
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
      {generate.isError ? <Alert tone="error">{errorMessage(generate.error)}</Alert> : null}
      {seed && !generate.isError ? (
        <small className="field-hint">
          Entrada generada del contrato de la versión · semilla {seed}. El resultado esperado lo
          decides tú: es lo que la prueba afirma.
        </small>
      ) : null}
    </div>
  );
}
