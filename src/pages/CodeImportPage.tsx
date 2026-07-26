import { useMutation } from '@tanstack/react-query';
import { FileCode2, GitBranch, Save, ShieldCheck, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { GeneratedGraphPreview } from '../components/GeneratedGraphPreview';
import { CodeImportIssuesList, type CodeImportIssue } from '../components/CodeImportIssuesList';
import { JsonTextarea } from '../components/JsonTextarea';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { asRecord, asRows, display } from '../utils/records';

const SAMPLE_SOURCE = `// @atlas-contract
// { "contractVersion": "1",
//   "inputs": [{ "id": "age", "name": "Age", "type": "INTEGER", "required": true }],
//   "outputs": [{ "id": "riskLevel", "name": "Risk Level", "type": "STRING", "required": true }] }
return { riskLevel: variables.age >= 21 ? 'LOW' : 'HIGH' };
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
  const issues = asRows(result.issues) as unknown as CodeImportIssue[];
  const generatedGraph = asRecord(result.generatedGraph);
  const dependencies = asRows(generatedGraph.dependencies);
  const nodes = asRows(generatedGraph.nodes);
  const hasBlockingIssues = issues.some((issue) => issue.severity === 'ERROR');
  const importId = display(result, 'id');

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
          <form className="code-import-form" onSubmit={submitAnalysis}>
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
            <button className="button button-primary" type="submit" disabled={analyze.isPending}>
              <FileCode2 size={16} /> Analizar
            </button>
            {analyze.isError ? <Alert tone="error">{errorMessage(analyze.error)}</Alert> : null}
          </form>
        </Panel>

        <Panel
          title="Resultado del análisis"
          meta={issues.length ? `${issues.length} observaciones` : 'Sin observaciones'}
        >
          {analyze.isSuccess ? (
            <>
              <CodeImportIssuesList issues={issues} />
              {!hasBlockingIssues && nodes.length ? (
                <div className="code-import-preview">
                  <h4>
                    <GitBranch size={14} aria-hidden="true" /> Grafo generado
                  </h4>
                  <p className="muted-text">
                    {nodes.length} nodos · {dependencies.length} variables
                  </p>
                  <GeneratedGraphPreview nodes={nodes} />
                  <ul className="dependency-list">
                    {dependencies.map((dependency, index) => (
                      <li key={index}>
                        <span className="dependency-node-key">
                          {display(dependency, 'usageType')}
                        </span>
                        {display(dependency, 'variableCode')}
                      </li>
                    ))}
                  </ul>
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
          <div className="code-import-form">
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
