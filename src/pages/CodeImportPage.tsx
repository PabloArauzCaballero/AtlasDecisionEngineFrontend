import { useMutation } from '@tanstack/react-query';
import { FileCode2, GitBranch, Languages, Save, ShieldCheck, Wand2, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { ImportTargetPicker } from '../features/code-import/ImportTargetPicker';
import { GeneratedGraphPreview } from '../components/GeneratedGraphPreview';
import { CodeImportIssuesList, type CodeImportIssue } from '../components/CodeImportIssuesList';
import { ImportBankPanel } from '../features/actions/ImportBankPanel';
import { InventoryCheckNote } from '../features/code-import/InventoryCheckNote';
import { ENGINE_CATALOG_ISSUE_CODES } from '../features/code-import/inventory-check';
import { SAMPLE_SOURCE } from '../features/code-import/sample-source';
import { useInventoryCheck } from '../features/code-import/useInventoryCheck';
import { localPythonIssues, stripUppercaseAccents } from '../components/code-import-issues';
import {
  detectSourceLanguage,
  languageMismatchIssues,
  LANGUAGE_LABELS,
  type ImportLanguage,
} from '../components/code-import-language';
import { JsonTextarea } from '../components/JsonTextarea';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { VariableList } from '../components/VariableIo';
import { asRecord, asRows, display } from '../utils/records';

/**
 * Code -> Flow generator (Fase 5): paste JS/Python, analyze it (syntax, contract,
 * security, generated graph preview), then save it as a draft graph or confirm
 * (validate + compile) on a target artifact version. See
 * docs/code-to-flow-specification.md.
 */
export function CodeImportPage() {
  const [language, setLanguage] = useState<ImportLanguage>('JAVASCRIPT');
  const [sourceCode, setSourceCode] = useState(SAMPLE_SOURCE);
  const [artifactVersionId, setArtifactVersionId] = useState('');
  const [expectedLockVersion, setExpectedLockVersion] = useState('1');

  const analyze = useMutation({
    mutationFn: () =>
      apiRequest<unknown>('/v1/code-imports', { method: 'POST', body: { language, sourceCode } }),
  });
  const result = asRecord(analyze.data);
  // La revisión local se antepone a la del motor: cuando detecta un carácter que
  // el analizador de Python rechaza —o que el selector de lenguaje no es el del
  // código pegado— señala la causa real en lugar de dejar que el motor culpe a
  // la línea 1 y dé por ausente una cabecera que sí está.
  const detected = detectSourceLanguage(sourceCode);
  const accentIssues = language === 'PYTHON' ? localPythonIssues(sourceCode) : [];
  const localIssues = [...languageMismatchIssues(sourceCode, language), ...accentIssues];
  const engineIssues = asRows(result.issues) as unknown as CodeImportIssue[];
  const engineCatalogIssues = engineIssues.filter((issue) =>
    ENGINE_CATALOG_ISSUE_CODES.has(issue.code),
  );
  // Lo que va MAL EN EL CÓDIGO esconde el grafo, porque no hay grafo que enseñar.
  // Lo que falta en el catálogo, no: ahí el algoritmo está bien y lo que hay que
  // arreglar es el inventario, para lo cual hay que ver qué pide el algoritmo.
  const codeIssues = [
    ...localIssues,
    ...engineIssues.filter((issue) => !ENGINE_CATALOG_ISSUE_CODES.has(issue.code)),
  ];
  const generatedGraph = asRecord(result.generatedGraph);
  const dependencies = asRows(generatedGraph.dependencies);
  const nodes = asRows(generatedGraph.nodes);
  const edges = asRows(generatedGraph.edges);
  const hasBlockingIssues = codeIssues.some((issue) => issue.severity === 'ERROR');
  // Lo mismo que se exige a cualquier artefacto: el contrato sólo puede usar
  // variables y motivos que el inventario ya tiene declarados.
  const inventory = useInventoryCheck({
    enabled: analyze.isSuccess && !hasBlockingIssues && nodes.length > 0,
    language,
    source: sourceCode,
    dependencies,
    nodes,
  });
  const catalogIssues = inventory.ready
    ? inventory.issues
    : [...engineCatalogIssues, ...inventory.issues];
  const issues = [...codeIssues, ...catalogIssues];
  const inventoryBlocked = catalogIssues.some((issue) => issue.severity === 'ERROR');
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
                onChange={(event) => setLanguage(event.target.value as ImportLanguage)}
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
              {detected && detected !== language ? (
                <button
                  className="button button-primary code-import-autofix"
                  type="button"
                  onClick={() => setLanguage(detected)}
                >
                  <Languages size={15} /> Cambiar el lenguaje a {LANGUAGE_LABELS[detected]}
                </button>
              ) : null}
              {accentIssues.length ? (
                <button
                  className="button button-primary code-import-autofix"
                  type="button"
                  onClick={() => setSourceCode(stripUppercaseAccents(sourceCode))}
                >
                  <Wand2 size={15} /> Quitar las tildes de las mayúsculas ({accentIssues.length})
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
                  <InventoryCheckNote check={inventory} />
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
            {/* Antes sólo se podía guardar en un borrador ya existente, así que
                importar un algoritmo NUEVO obligaba a irse a otra pantalla,
                crearlo a mano y volver — y quien no lo sabía se quedaba con el
                botón apagado sin explicación. */}
            <ImportTargetPicker
              versionId={artifactVersionId}
              onVersionChange={setArtifactVersionId}
              onLockVersionChange={setExpectedLockVersion}
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
            {/* Guardar con el contrato fuera del inventario no falla: el motor CREA
                sola cada variable que no encuentre, sin dueño ni clasificación. Por
                eso se frena aquí, que es donde todavía se puede declarar bien. */}
            {inventoryBlocked ? (
              <Alert tone="error">
                <XCircle size={14} aria-hidden="true" /> El contrato usa variables o motivos que el
                inventario no tiene declarados. Decláralos primero en el catálogo: un artefacto no
                estrena variables al guardarse.
              </Alert>
            ) : null}
            <div className="inline-actions">
              <button
                className="button"
                type="button"
                disabled={!artifactVersionId || write.isPending || inventoryBlocked}
                onClick={() => write.mutate('save-draft')}
              >
                <Save size={16} /> Guardar borrador
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!artifactVersionId || write.isPending || inventoryBlocked}
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
