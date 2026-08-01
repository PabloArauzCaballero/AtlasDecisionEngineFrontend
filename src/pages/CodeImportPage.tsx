import { useMutation } from '@tanstack/react-query';
import { FileCode2, GitBranch, Save, ShieldCheck, Wand2, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { GeneratedGraphPreview } from '../components/GeneratedGraphPreview';
import { CodeImportIssuesList, type CodeImportIssue } from '../components/CodeImportIssuesList';
import { ImportBankPanel } from '../features/actions/ImportBankPanel';
import { localPythonIssues, stripUppercaseAccents } from '../components/code-import-issues';
import { JsonTextarea } from '../components/JsonTextarea';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { VariableList } from '../components/VariableIo';
import { asRecord, asRows, display } from '../utils/records';

// Ejemplo con una cadena if/else if/else: es la forma que el analizador convierte
// en un ÁRBOL de condiciones y resultados, no en un único nodo de script.
const SAMPLE_SOURCE = `// @atlas-contract
// { "contractVersion": "1",
//   "inputs": [
//     { "id": "edad", "name": "Edad", "type": "INTEGER", "required": true },
//     { "id": "score_buro", "name": "Score de buró", "type": "INTEGER", "required": true },
//     { "id": "ingreso_mensual", "name": "Ingreso mensual", "type": "NUMBER", "required": true }],
//   "outputs": [
//     { "id": "decision", "name": "Decisión", "type": "STRING", "required": true },
//     { "id": "motivo", "name": "Motivo", "type": "STRING", "required": true },
//     { "id": "limite", "name": "Límite aprobado", "type": "NUMBER", "required": true }],
//   "primaryOutputId": "decision",
//   "reasonOutputId": "motivo" }
if (variables.edad < 18) {
  return { decision: 'RECHAZADO', motivo: 'AGE_NOT_ELIGIBLE', limite: 0 };
} else if (variables.score_buro < 550) {
  return { decision: 'RECHAZADO', motivo: 'BUREAU_SCORE_TOO_LOW', limite: 0 };
} else if (variables.score_buro >= 700) {
  return { decision: 'APROBADO', motivo: 'APPROVED_POLICY', limite: variables.ingreso_mensual * 0.35 };
} else {
  return { decision: 'REVISION', motivo: 'SCORE_BAND_BORDERLINE', limite: 0 };
}
`;

/**
 * Code -> Flow generator (Fase 5): paste JS/Python, analyze it (syntax, contract,
 * security, generated graph preview), then save it as a draft graph or confirm
 * (validate + compile) on a target artifact version. See
 * docs/code-to-flow-specification.md.
 */
export function CodeImportPage() {
  const [language, setLanguage] = useState<'JAVASCRIPT' | 'PYTHON'>('JAVASCRIPT');
  const [sourceCode, setSourceCode] = useState(SAMPLE_SOURCE);
  const [artifactVersionId, setArtifactVersionId] = useState('');
  const [expectedLockVersion, setExpectedLockVersion] = useState('1');

  const analyze = useMutation({
    mutationFn: () =>
      apiRequest<unknown>('/v1/code-imports', { method: 'POST', body: { language, sourceCode } }),
  });
  const result = asRecord(analyze.data);
  // La revisión local se antepone a la del motor: cuando detecta un carácter que
  // el analizador de Python rechaza, señala la línea real en lugar de dejar que
  // el motor culpe a la línea 1.
  const localIssues = language === 'PYTHON' ? localPythonIssues(sourceCode) : [];
  const issues = [...localIssues, ...(asRows(result.issues) as unknown as CodeImportIssue[])];
  const generatedGraph = asRecord(result.generatedGraph);
  const dependencies = asRows(generatedGraph.dependencies);
  const nodes = asRows(generatedGraph.nodes);
  const edges = asRows(generatedGraph.edges);
  const hasBlockingIssues = issues.some((issue) => issue.severity === 'ERROR');
  const importId = display(result, 'id');
  const conditionCount = nodes.filter((node) => display(node, 'type') === 'CONDITION').length;
  const inputs = dependencies.filter(
    (dependency) => !display(dependency, 'usageType').startsWith('OUTPUT'),
  );
  const outputs = dependencies.filter((dependency) =>
    display(dependency, 'usageType').startsWith('OUTPUT'),
  );

  const write = useMutation({
    mutationFn: (action: 'save-draft' | 'confirm') =>
      apiRequest<unknown>(`/v1/code-imports/${encodeURIComponent(importId)}/${action}`, {
        method: 'POST',
        body: { artifactVersionId, expectedLockVersion: Number(expectedLockVersion) },
      }),
  });

  const submitAnalysis = (event: FormEvent) => {
    event.preventDefault();
    write.reset();
    analyze.mutate();
  };

  return (
    <>
      <PageHeader
        eyebrow="F5 · Code to Flow"
        title="Importar código como árbol de decisión"
        description="Analiza JavaScript o Python con un contrato @atlas-contract declarado, revisa el grafo generado, y guárdalo como borrador o confírmalo."
      />
      <div className="code-import-layout">
        <Panel title="Código fuente" meta={language}>
          <form
            className="code-import-form"
            onSubmit={submitAnalysis}
            data-tutorial-id="code-import-form"
          >
            <label className="field">
              <span>Lenguaje</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'JAVASCRIPT' | 'PYTHON')}
              >
                <option value="JAVASCRIPT">JavaScript</option>
                <option value="PYTHON">Python</option>
              </select>
            </label>
            <JsonTextarea
              id="code-import-source"
              label="Código"
              value={sourceCode}
              onChange={setSourceCode}
              rows={16}
            />
            <button
              className="button button-primary"
              type="submit"
              data-tutorial-id="code-import-analyze"
              disabled={analyze.isPending}
            >
              <FileCode2 size={16} /> Analizar
            </button>
            {analyze.isError ? <Alert tone="error">{errorMessage(analyze.error)}</Alert> : null}
          </form>
        </Panel>

        <Panel
          title="Resultado del análisis"
          meta={issues.length ? `${issues.length} observaciones` : 'Sin observaciones'}
        >
          {/* La revisión local no espera a pulsar "Analizar": avisar antes de
              enviar ahorra el viaje y un error que culpa a la línea 1. */}
          {analyze.isSuccess || localIssues.length ? (
            <>
              <CodeImportIssuesList issues={issues} />
              {localIssues.length ? (
                <button
                  className="button button-primary code-import-autofix"
                  type="button"
                  onClick={() => setSourceCode(stripUppercaseAccents(sourceCode))}
                >
                  <Wand2 size={15} /> Quitar las tildes de las mayúsculas ({localIssues.length})
                </button>
              ) : null}
              {!hasBlockingIssues && nodes.length ? (
                <div className="code-import-preview" data-tutorial-id="code-import-preview">
                  <h4>
                    <GitBranch size={14} aria-hidden="true" /> Grafo generado
                  </h4>
                  <p className="muted-text">
                    {conditionCount
                      ? `Árbol de decisión: ${conditionCount} ${
                          conditionCount === 1 ? 'condición' : 'condiciones'
                        } · ${nodes.length} nodos`
                      : `${nodes.length} nodos · el código se importa como un único nodo de script`}
                  </p>
                  <GeneratedGraphPreview nodes={nodes} edges={edges} />
                  <VariableList
                    title="Entradas"
                    hint="Datos que la decisión necesita recibir"
                    tone="in"
                    variables={inputs}
                  />
                  <VariableList
                    title="Salidas"
                    hint="Resultados que la decisión devuelve"
                    tone="out"
                    variables={outputs}
                  />
                  <ImportBankPanel
                    nodes={nodes}
                    emittedReasonCodes={asRows(generatedGraph.actions).map((action) =>
                      display(action, 'reasonCode'),
                    )}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">Analiza el código para ver el resultado.</div>
          )}
        </Panel>
      </div>

      {analyze.isSuccess && !hasBlockingIssues ? (
        <Panel title="Guardar en un artefacto" meta={`Import #${importId}`}>
          <div className="code-import-form" data-tutorial-id="code-import-save">
            <ArtifactVersionPicker
              versionId={artifactVersionId}
              onVersionChange={setArtifactVersionId}
              versionLabel="Versión destino (borrador)"
            />
            <label className="field">
              <span>Lock Version esperado</span>
              <input
                type="number"
                min={1}
                value={expectedLockVersion}
                onChange={(event) => setExpectedLockVersion(event.target.value)}
              />
            </label>
            <div className="inline-actions">
              <button
                className="button"
                type="button"
                disabled={!artifactVersionId || write.isPending}
                onClick={() => write.mutate('save-draft')}
              >
                <Save size={16} /> Guardar borrador
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!artifactVersionId || write.isPending}
                onClick={() => write.mutate('confirm')}
              >
                <ShieldCheck size={16} /> Confirmar (validar + compilar)
              </button>
            </div>
            {write.isError ? (
              <Alert tone="error">
                <XCircle size={14} aria-hidden="true" /> {errorMessage(write.error)}
              </Alert>
            ) : null}
            {write.isSuccess ? <Alert tone="success">Grafo escrito correctamente.</Alert> : null}
          </div>
        </Panel>
      ) : null}
    </>
  );
}
