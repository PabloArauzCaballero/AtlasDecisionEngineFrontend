import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { JsonTextarea } from '../components/JsonTextarea';
import { Panel } from '../components/Panel';
import { parseJsonObject } from '../utils/json';
import { GenerateCaseInputButton } from './GenerateCaseInputButton';
import { testCaseSchema, type TestCase } from './testing.schemas';

interface CreateTestCaseFormProps {
  suiteId: string;
  /** Versión que prueba la suite; sin ella no se puede generar una entrada de ejemplo. */
  artifactVersionId?: string;
  onCreated: (testCase: TestCase) => void;
  onCancel: () => void;
}

export function CreateTestCaseForm({
  suiteId,
  artifactVersionId,
  onCreated,
  onCancel,
}: CreateTestCaseFormProps) {
  const [caseCode, setCaseCode] = useState('CASE_');
  const [testName, setTestName] = useState('');
  const [input, setInput] = useState('{}');
  const [expectedResult, setExpectedResult] = useState('{}');
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/test-suites/${encodeURIComponent(suiteId)}/cases`, {
        method: 'POST',
        body: {
          caseCode: caseCode.trim().toUpperCase(),
          testName: testName.trim(),
          input: parseJsonObject(input),
          expectedResult: parseJsonObject(expectedResult),
          isActive: true,
        },
        responseSchema: testCaseSchema,
      }),
    onSuccess: onCreated,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <Panel title="Agregar caso" meta={`Suite ${suiteId}`}>
      <form className="simulator-form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            <span>Código</span>
            <input
              required
              value={caseCode}
              onChange={(event) => setCaseCode(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Nombre</span>
            <input
              required
              value={testName}
              onChange={(event) => setTestName(event.target.value)}
            />
          </label>
        </div>
        {artifactVersionId ? (
          <GenerateCaseInputButton
            artifactVersionId={artifactVersionId}
            onGenerated={(generated) => setInput(JSON.stringify(generated, null, 2))}
          />
        ) : null}
        <JsonTextarea
          id="new-case-input"
          label="Entrada (JSON)"
          value={input}
          onChange={setInput}
        />
        <JsonTextarea
          id="new-case-expected"
          label="Resultado esperado (JSON)"
          value={expectedResult}
          onChange={setExpectedResult}
        />
        {create.isError ? <Alert tone="error">{errorMessage(create.error)}</Alert> : null}
        <div className="inline-actions">
          <button className="button button-primary" type="submit" disabled={create.isPending}>
            {create.isPending ? 'Guardando…' : 'Guardar caso'}
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </Panel>
  );
}
