'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { CalculatedFieldSampleControls } from './CalculatedFieldSampleControls';
import { parseInputValues, stringifyInput } from './calculated-field-values';
import { draftBlocker, testCall, tryCall, type TryTarget } from './calculated-field-preview';

interface Props {
  target: TryTarget;
  inputs: UnknownRecord[];
  testCases: UnknownRecord[];
}

/**
 * Ejecuta el cálculo con valores de ejemplo y corre sus casos de prueba (§6.1).
 *
 * Nada se persiste: es una ejecución contra el mismo motor aislado que usa producción, así
 * que lo que se ve aquí es lo que pasará de verdad. El panel es EL MISMO antes y después de
 * crear el campo —sólo cambia a dónde apunta—, porque el momento en que más falta hace
 * probar es justo antes de crear nada.
 */
export function CalculatedFieldTryPanel({ target, inputs, testCases }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const blocked = target.kind === 'DRAFT' ? draftBlocker(target.draft) : null;

  const tryRun = useMutation({
    mutationFn: () => {
      const call = tryCall(target, parseInputValues(inputs, values));
      return apiRequest<UnknownRecord>(call.path, { method: 'POST', body: call.body });
    },
  });

  const runTests = useMutation({
    mutationFn: () => {
      const call = testCall(target);
      return apiRequest<UnknownRecord>(call.path, { method: 'POST', body: call.body });
    },
  });

  const report = asRecord(runTests.data);
  const result = asRecord(tryRun.data);

  return (
    <div className="calculated-try" data-tutorial-id="calculated-field-try">
      <h4>Probar con un ejemplo</h4>

      <CalculatedFieldSampleControls
        target={target}
        blocked={blocked}
        onLoad={(input) => setValues(stringifyInput(input))}
      />

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
      {!inputs.length ? (
        <small className="field-hint">
          Este cálculo todavía no declara entradas: añádelas arriba y aparecerán aquí.
        </small>
      ) : null}

      <div className="panel-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={tryRun.isPending || Boolean(blocked)}
          title={blocked ?? undefined}
          onClick={() => tryRun.mutate()}
        >
          <Play size={14} aria-hidden /> {tryRun.isPending ? 'Ejecutando…' : 'Ejecutar ejemplo'}
        </button>
        {testCases.length ? (
          <button
            type="button"
            className="button"
            disabled={runTests.isPending || Boolean(blocked)}
            onClick={() => runTests.mutate()}
          >
            {runTests.isPending ? 'Ejecutando…' : `Ejecutar los ${testCases.length} casos`}
          </button>
        ) : null}
      </div>

      {tryRun.isSuccess ? (
        <p className="constraint-result constraint-valid">
          <CheckCircle2 size={14} aria-hidden /> Resultado:{' '}
          <code>{JSON.stringify(result.value)}</code> · {display(result, 'outcome')} en{' '}
          {display(result, 'durationMs')} ms
        </p>
      ) : null}
      {tryRun.isError ? <ExecutionError error={tryRun.error} /> : null}

      {runTests.isSuccess ? (
        <div className="calculated-test-report">
          <p>
            {String(report.passed)} de {String(report.total)} casos correctos
            {Number(report.failed) > 0 ? ` · ${String(report.failed)} fallan` : ''}
          </p>
          <ul>
            {asRows(report.results).map((entry, index) => (
              <li key={index} className={entry.passed ? 'is-pass' : 'is-fail'}>
                {entry.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                <b>{display(entry, 'name')}</b>
                {!entry.passed ? (
                  <small>
                    esperado <code>{JSON.stringify(entry.expected)}</code>, obtenido{' '}
                    <code>{JSON.stringify(entry.error ?? entry.actual)}</code>
                  </small>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {runTests.isError ? <ExecutionError error={runTests.error} /> : null}
    </div>
  );
}

/**
 * Un fallo de ejecución puede ser el contrato entero, no una frase.
 *
 * El motor devuelve TODOS los incumplimientos de una vez al ensayar un borrador —los
 * mismos que devolvería al guardar—, y aplastarlos en una línea obligaba a corregir uno,
 * volver a probar y descubrir el siguiente.
 */
function ExecutionError({ error }: { error: unknown }) {
  const issues = asRows(asRecord(asRecord(error as UnknownRecord).details).issues);
  if (!issues.length) {
    return (
      <p className="constraint-result constraint-invalid">
        <XCircle size={14} aria-hidden /> {errorMessage(error)}
      </p>
    );
  }
  return (
    <Alert tone="error">
      <strong>El contrato no es válido todavía:</strong>
      <ul>
        {issues.map((issue, index) => (
          <li key={index}>
            {display(issue, 'message')}
            {issue.path ? ` (${display(issue, 'path')})` : ''}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
