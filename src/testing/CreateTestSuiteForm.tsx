import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { Panel } from '../components/Panel';
import { parseJsonObject } from '../utils/json';
import { CaseInputEditor } from './CaseInputEditor';
import { GenerateCaseInputButton } from './GenerateCaseInputButton';
import { SUITE_TYPES, suiteType } from './suite-types';
import { testSuiteSchema, type TestSuite } from './testing.schemas';

interface CreateTestSuiteFormProps {
  versionId: string;
  onCreated: (suite: TestSuite) => void;
  onCancel: () => void;
}

export function CreateTestSuiteForm({ versionId, onCreated, onCancel }: CreateTestSuiteFormProps) {
  const [suiteCode, setSuiteCode] = useState('');
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState('REGRESSION');
  const type = suiteType(selectedType);
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
          suiteType: type.code,
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
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
              {SUITE_TYPES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            {/* Qué es cada tipo, aquí y no en un manual: el tipo decide además
                con qué valores se siembra el primer caso. */}
            <small className="field-hint">{type.purpose}</small>
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
        {/*
          El primer caso de la suite es un caso como cualquier otro, así que se
          rellena igual que en «Casos de Prueba»: escribir a mano un JSON que
          cumpla el contrato de la versión obliga a ir consultando el catálogo
          campo por campo, y un nombre mal escrito no se ve hasta el 422.
        */}
        {versionId ? (
          <GenerateCaseInputButton
            artifactVersionId={versionId}
            defaultKind={type.defaultKind}
            kindReason={type.kindReason}
            onGenerated={(generated) => setInput(JSON.stringify(generated, null, 2))}
          />
        ) : (
          // Ver la nota en `CreateTestCaseForm`: la ausencia del generador se
          // explica en vez de dejar un hueco.
          <Alert tone="info">
            Elige una versión arriba para poder generar valores de ejemplo: salen de su contrato de
            entrada.
          </Alert>
        )}
        <CaseInputEditor
          artifactVersionId={versionId}
          id="new-suite-input"
          label="Entrada del caso (JSON)"
          value={input}
          onChange={setInput}
        />
        {/*
         * El resultado esperado NO se rellena con el contrato de entrada: es lo
         * que la prueba afirma, y ofrecer un formulario con las mismas variables
         * invitaría a copiar la entrada como si fuera la respuesta.
         */}
        <CaseInputEditor
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
