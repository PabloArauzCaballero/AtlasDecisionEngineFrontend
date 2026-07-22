import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { JsonTextarea } from '../components/JsonTextarea';
import { Panel } from '../components/Panel';
import { parseJsonObject } from '../utils/json';
import { testSuiteSchema, type TestSuite } from './testing.schemas';

interface CreateTestSuiteFormProps {
  versionId: string;
  onCreated: (suite: TestSuite) => void;
  onCancel: () => void;
}

export function CreateTestSuiteForm({ versionId, onCreated, onCancel }: CreateTestSuiteFormProps) {
  const [suiteCode, setSuiteCode] = useState('');
  const [name, setName] = useState('');
  const [suiteType, setSuiteType] = useState('REGRESSION');
  const [isBlocking, setIsBlocking] = useState(true);
  const [caseCode, setCaseCode] = useState('CASE_001');
  const [testName, setTestName] = useState('Caso inicial');
  const [input, setInput] = useState('{}');
  const [expectedResult, setExpectedResult] = useState('{}');
  const create = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/artifact-versions/${encodeURIComponent(versionId)}/test-suites`, {
        method: 'POST',
        body: {
          suiteCode: suiteCode.trim().toUpperCase(),
          name: name.trim(),
          suiteType,
          isBlocking,
          cases: [
            {
              caseCode: caseCode.trim().toUpperCase(),
              testName: testName.trim(),
              input: parseJsonObject(input),
              expectedResult: parseJsonObject(expectedResult),
              isActive: true,
            },
          ],
        },
        responseSchema: testSuiteSchema,
      }),
    onSuccess: onCreated,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <Panel title="Crear suite" meta={`Versión ${versionId}`}>
      <form className="simulator-form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            <span>Código</span>
            <input
              required
              value={suiteCode}
              onChange={(event) => setSuiteCode(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Nombre</span>
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Tipo</span>
            <select value={suiteType} onChange={(event) => setSuiteType(event.target.value)}>
              <option value="REGRESSION">Regresión</option>
              <option value="SMOKE">Smoke</option>
              <option value="VALIDATION">Validación</option>
            </select>
          </label>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={isBlocking}
                onChange={(event) => setIsBlocking(event.target.checked)}
              />{' '}
              Suite bloqueante
            </span>
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Código del primer caso</span>
            <input
              required
              value={caseCode}
              onChange={(event) => setCaseCode(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Nombre del caso</span>
            <input
              required
              value={testName}
              onChange={(event) => setTestName(event.target.value)}
            />
          </label>
        </div>
        <JsonTextarea
          id="new-suite-input"
          label="Entrada (JSON)"
          value={input}
          onChange={setInput}
        />
        <JsonTextarea
          id="new-suite-expected"
          label="Resultado esperado (JSON)"
          value={expectedResult}
          onChange={setExpectedResult}
        />
        {create.isError ? <Alert tone="error">{errorMessage(create.error)}</Alert> : null}
        <div className="inline-actions">
          <button className="button button-primary" type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear suite'}
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </Panel>
  );
}
