import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { Panel } from '../components/Panel';
import { parseJsonObject } from '../utils/json';
import { CaseInputEditor } from './CaseInputEditor';
import { GenerateCaseInputButton } from './GenerateCaseInputButton';
import { suiteType } from './suite-types';
import { testCaseSchema, type TestCase } from './testing.schemas';

interface CreateTestCaseFormProps {
  suiteId: string;
  /** Versión que prueba la suite; sin ella no se puede generar una entrada de ejemplo. */
  artifactVersionId?: string;
  /** Tipo de la suite a la que se añade: decide con qué valores se siembra. */
  suiteTypeCode?: string;
  onCreated: (testCase: TestCase) => void;
  onCancel: () => void;
}

export function CreateTestCaseForm({
  suiteId,
  artifactVersionId,
  suiteTypeCode,
  onCreated,
  onCancel,
}: CreateTestCaseFormProps) {
  const type = suiteType(suiteTypeCode ?? '');
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
            defaultKind={type.defaultKind}
            kindReason={suiteTypeCode ? type.kindReason : undefined}
            onGenerated={(generated) => setInput(JSON.stringify(generated, null, 2))}
          />
        ) : (
          /*
           * Que la ausencia se explique. El botón simplemente no se pintaba
           * cuando la versión no se había resuelto —el catálogo de suites no
           * había llegado, o falló—, y desde fuera eso se lee como «esta
           * pantalla no tiene generación de casos», que es falso.
           */
          <Alert tone="info">
            No se pudo resolver a qué versión pertenece esta suite, así que no se pueden generar
            valores de ejemplo: el contrato del que salen es el de esa versión. Vuelve a elegir la
            suite; si persiste, el catálogo de suites no está respondiendo.
          </Alert>
        )}
        <CaseInputEditor
          artifactVersionId={artifactVersionId}
          id="new-case-input"
          label="Entrada del caso (JSON)"
          value={input}
          onChange={setInput}
        />
        {/* El esperado es lo que la prueba AFIRMA: no se deriva del contrato de
            entrada ni se rellena solo. */}
        <CaseInputEditor
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
