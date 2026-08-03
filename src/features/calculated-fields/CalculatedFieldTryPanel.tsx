'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, Play, Wand2, XCircle } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  versionId: string;
  inputs: UnknownRecord[];
  testCases: UnknownRecord[];
}

/**
 * Ejecuta la versión con valores de ejemplo y corre sus casos de prueba (§6.1).
 *
 * Nada se persiste: es una ejecución de prueba contra el mismo motor aislado que usa
 * producción, así que lo que se ve aquí es lo que pasará de verdad.
 */
export function CalculatedFieldTryPanel({ versionId, inputs, testCases }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const tryRun = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/calculated-fields/versions/${encodeURIComponent(versionId)}/try`,
        { method: 'POST', body: { inputs: parseValues(inputs, values) } },
      ),
  });

  /**
   * Rellena el formulario con valores derivados del contrato de la versión.
   *
   * Los genera el backend con el MISMO generador del QA Lab, no el navegador: así
   * «válido» y «frontera» significan aquí lo mismo que allí, y el lote es
   * reproducible por semilla. Se escriben en el formulario en vez de ejecutarse
   * directamente, para poder revisarlos —o retocarlos— antes de probar.
   */
  const generate = useMutation({
    mutationFn: (kind: 'VALID' | 'BOUNDARY' | 'INVALID') =>
      apiRequest<UnknownRecord>(
        `/v1/calculated-fields/versions/${encodeURIComponent(versionId)}/sample-inputs`,
        { method: 'POST', body: { kind, count: 1 } },
      ),
    onSuccess: (batch) => {
      const generated = asRecord(asRows(asRecord(batch).cases)[0]).input;
      if (!generated) return;
      setValues(
        Object.fromEntries(
          Object.entries(asRecord(generated)).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
          ]),
        ),
      );
    },
  });

  const runTests = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/calculated-fields/versions/${encodeURIComponent(versionId)}/test`,
        { method: 'POST', body: {} },
      ),
  });

  const report = asRecord(runTests.data);
  const generatedSeed = display(asRecord(generate.data), 'seed');

  return (
    <div className="calculated-try">
      <h4>Probar con un ejemplo</h4>
      <div className="constraint-grid">
        {inputs.map((input) => {
          const id = display(input, 'id');
          return (
            <label className="constraint-field" key={id}>
              <span>
                {display(input, 'name') || id}
                {input.required ? ' *' : ''}
              </span>
              <input
                value={values[id] ?? ''}
                placeholder={display(input, 'dataType')}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [id]: event.target.value }))
                }
              />
            </label>
          );
        })}
      </div>

      <div className="panel-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={tryRun.isPending}
          onClick={() => tryRun.mutate()}
        >
          <Play size={14} aria-hidden /> {tryRun.isPending ? 'Ejecutando…' : 'Ejecutar ejemplo'}
        </button>
        {inputs.length ? (
          <>
            <button
              type="button"
              className="button"
              disabled={generate.isPending}
              title="Rellena el formulario con valores que cumplen el contrato"
              onClick={() => generate.mutate('VALID')}
            >
              <Wand2 size={14} aria-hidden />{' '}
              {generate.isPending ? 'Generando…' : 'Generar ejemplo'}
            </button>
            <button
              type="button"
              className="button"
              disabled={generate.isPending}
              title="Valores en el límite de las restricciones: es donde suelen aparecer los fallos"
              onClick={() => generate.mutate('BOUNDARY')}
            >
              En el límite
            </button>
            <button
              type="button"
              className="button"
              disabled={generate.isPending}
              title="Valores que el contrato DEBE rechazar: comprueba que la política de error funciona"
              onClick={() => generate.mutate('INVALID')}
            >
              Inválido
            </button>
          </>
        ) : null}
        {testCases.length ? (
          <button
            type="button"
            className="button"
            disabled={runTests.isPending}
            onClick={() => runTests.mutate()}
          >
            {runTests.isPending ? 'Ejecutando…' : `Ejecutar los ${testCases.length} casos`}
          </button>
        ) : null}
      </div>

      {generate.isSuccess && generatedSeed !== '—' ? (
        <small className="field-hint">
          Valores generados del contrato · semilla <code>{generatedSeed}</code> — repítela para
          reproducir exactamente este mismo lote.
        </small>
      ) : null}
      {generate.isError ? (
        <p className="constraint-result constraint-invalid">
          <XCircle size={14} aria-hidden /> {errorMessage(generate.error)}
        </p>
      ) : null}

      {tryRun.isSuccess ? (
        <p className="constraint-result constraint-valid">
          <CheckCircle2 size={14} aria-hidden /> Resultado:{' '}
          <code>{JSON.stringify(asRecord(tryRun.data).value)}</code> ·{' '}
          {display(asRecord(tryRun.data), 'outcome')} en{' '}
          {display(asRecord(tryRun.data), 'durationMs')} ms
        </p>
      ) : null}
      {tryRun.isError ? (
        <p className="constraint-result constraint-invalid">
          <XCircle size={14} aria-hidden /> {errorMessage(tryRun.error)}
        </p>
      ) : null}

      {runTests.isSuccess ? (
        <div className="calculated-test-report">
          <p>
            {String(report.passed)} de {String(report.total)} casos correctos
            {Number(report.failed) > 0 ? ` · ${String(report.failed)} fallan` : ''}
          </p>
          <ul>
            {asRows(report.results).map((result, index) => (
              <li key={index} className={result.passed ? 'is-pass' : 'is-fail'}>
                {result.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                <b>{display(result, 'name')}</b>
                {!result.passed ? (
                  <small>
                    esperado <code>{JSON.stringify(result.expected)}</code>, obtenido{' '}
                    <code>{JSON.stringify(result.error ?? result.actual)}</code>
                  </small>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {runTests.isError ? (
        <p className="constraint-result constraint-invalid">
          <XCircle size={14} aria-hidden /> {errorMessage(runTests.error)}
        </p>
      ) : null}
    </div>
  );
}

/** Convierte los valores del formulario al tipo declarado por cada entrada. */
function parseValues(
  inputs: UnknownRecord[],
  values: Record<string, string>,
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const input of inputs) {
    const id = display(input, 'id');
    const raw = values[id];
    if (raw === undefined || raw === '') continue;
    const type = display(input, 'dataType');
    if (['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY'].includes(type)) {
      parsed[id] = Number(raw);
    } else if (type === 'BOOLEAN') {
      parsed[id] = raw === 'true';
    } else if (type === 'LIST' || type === 'OBJECT') {
      try {
        parsed[id] = JSON.parse(raw);
      } catch {
        parsed[id] = raw;
      }
    } else {
      parsed[id] = raw;
    }
  }
  return parsed;
}
