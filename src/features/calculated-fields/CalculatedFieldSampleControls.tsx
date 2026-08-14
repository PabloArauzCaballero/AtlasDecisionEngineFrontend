'use client';

import { useMutation } from '@tanstack/react-query';
import { Dices } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { CalculatedFieldOutcomeReport } from './CalculatedFieldOutcomeReport';
import {
  KIND_HINTS,
  KIND_LABELS,
  outcomeReportSchema,
  outcomesCall,
  sampleBatchSchema,
  sampleCall,
  SAMPLE_KINDS,
  type OutcomeReport,
  type SampleBatch,
  type SampleKind,
  type TryTarget,
} from './calculated-field-preview';

interface Props {
  target: TryTarget;
  /** Motivo por el que todavía no se puede generar; null si se puede. */
  blocked: string | null;
  onLoad: (input: Record<string, unknown>) => void;
}

/**
 * Datos de prueba a la medida: qué clase, cuántos y con qué semilla.
 *
 * Antes eran tres botones que pedían UN caso válido, uno de frontera o uno inválido, sin
 * número ni semilla. Un caso no basta para creerse nada, y sin semilla lo que acababa de
 * fallar no se podía volver a producir: la reproducibilidad la da el motor y el portal la
 * estaba tirando a la basura.
 *
 * Los valores se escriben en el formulario en vez de ejecutarse solos, para poder
 * revisarlos —o retocarlos— antes de probar.
 */
export function CalculatedFieldSampleControls({ target, blocked, onLoad }: Props) {
  const [kind, setKind] = useState<SampleKind>('VALID');
  const [count, setCount] = useState(3);
  const [seed, setSeed] = useState('');
  const [batch, setBatch] = useState<SampleBatch | null>(null);
  const [report, setReport] = useState<OutcomeReport | null>(null);
  const [active, setActive] = useState(0);

  const generate = useMutation({
    mutationFn: async (): Promise<{
      outcomes: OutcomeReport | null;
      batch: SampleBatch | null;
    }> => {
      if (kind === 'OUTCOMES') {
        const call = outcomesCall(target, { count, seed });
        const outcomes = await apiRequest(call.path, {
          method: 'POST',
          body: call.body,
          responseSchema: outcomeReportSchema,
        });
        return { outcomes, batch: null };
      }
      const call = sampleCall(target, { kind, count, seed });
      const batch = await apiRequest(call.path, {
        method: 'POST',
        body: call.body,
        responseSchema: sampleBatchSchema,
      });
      return { outcomes: null, batch };
    },
    onSuccess: (data) => {
      setReport(data.outcomes);
      setBatch(data.batch);
      setActive(0);
      if (data.batch?.cases.length) onLoad(data.batch.cases[0].input);
      // La semilla vuelve al formulario para que repetir la tanda sea pulsar otra vez.
      const used = data.outcomes?.seed ?? data.batch?.seed;
      if (used) setSeed(used);
    },
  });

  const unsatisfiable = [
    ...new Set((batch?.cases ?? []).flatMap((entry) => entry.unsatisfiable ?? [])),
  ];

  return (
    <div className="calculated-sample-bar">
      <div className="sample-bar-actions">
        <label className="constraint-field">
          <span>Datos de prueba</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as SampleKind)}>
            {SAMPLE_KINDS.map((option) => (
              <option key={option} value={option}>
                {KIND_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="constraint-field">
          <span>{kind === 'OUTCOMES' ? 'Casos por clase' : 'Casos'}</span>
          <input
            type="number"
            min={1}
            max={kind === 'OUTCOMES' ? 10 : 20}
            value={count}
            onChange={(event) => {
              const top = kind === 'OUTCOMES' ? 10 : 20;
              setCount(Math.min(top, Math.max(1, Number(event.target.value) || 1)));
            }}
          />
        </label>
        <label className="constraint-field">
          <span>Semilla</span>
          <input
            placeholder="vacía = una nueva"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={Boolean(blocked) || generate.isPending}
          title={blocked ?? undefined}
          onClick={() => generate.mutate()}
        >
          <Dices size={14} aria-hidden /> {generate.isPending ? 'Generando…' : 'Generar'}
        </button>
      </div>

      <small className="field-hint">{KIND_HINTS[kind]}</small>
      {blocked ? <small className="field-hint">{blocked}</small> : null}
      {generate.isError ? <Alert tone="error">{errorMessage(generate.error)}</Alert> : null}

      {batch ? (
        <>
          <small className="field-hint">
            {batch.cases.length} casos · semilla <code>{batch.seed}</code> — repítela para
            reproducir exactamente este lote.
          </small>
          {unsatisfiable.length ? (
            <Alert tone="warning">
              Estas entradas no admiten NINGÚN valor válido con las restricciones declaradas, así
              que lo generado para ellas no cumple el contrato: {unsatisfiable.join(', ')}.
            </Alert>
          ) : null}
          {batch.cases.length > 1 ? (
            <div className="sample-bar-cases" role="group" aria-label="Casos generados">
              {batch.cases.map((sample, index) => (
                <button
                  key={sample.index}
                  type="button"
                  className="sample-case-chip"
                  aria-pressed={index === active}
                  onClick={() => {
                    setActive(index);
                    onLoad(sample.input);
                  }}
                >
                  Caso {sample.index + 1}
                  {sample.mutation ? ` · ${sample.mutation}` : ''}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {report ? <CalculatedFieldOutcomeReport report={report} /> : null}
    </div>
  );
}
