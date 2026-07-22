import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Circle, Code2, Play, Save, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { PickerSelect } from '../components/PickerSelect';
import { useNotifications } from '../notifications/useNotifications';
import { display } from '../utils/records';

const DRAFT_KEY = 'compile-wizard-draft';

interface CompilePageProps {
  initialVersionId: string;
}

export function CompilePage({ initialVersionId }: CompilePageProps) {
  const [versionId, setVersionId] = useState(initialVersionId);
  const { notify } = useNotifications();

  // Restores a hand-saved draft, but never over a version arriving in the URL.
  useEffect(() => {
    if (initialVersionId) return;
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) setVersionId(draft);
  }, [initialVersionId]);

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, versionId);
    notify({
      tone: 'success',
      title: 'Borrador guardado',
      description: versionId
        ? `El wizard reabrirá con la versión ${versionId} preseleccionada.`
        : 'El borrador quedó vacío; el wizard abrirá sin versión.',
    });
  };
  const action = useMutation({
    mutationFn: (operation: 'validate' | 'compile') =>
      apiRequest(`/v1/artifact-versions/${encodeURIComponent(versionId)}/${operation}`, {
        method: 'POST',
        body: {},
      }),
    // Failures are reported globally by the mutation cache; only the success
    // path needs a message here.
    onSuccess: (_data, operation) =>
      notify({
        tone: 'success',
        title: operation === 'compile' ? 'Compilación completada' : 'Validación completada',
        description: `Versión ${versionId} procesada sin errores bloqueantes.`,
      }),
  });
  const pendingOperation = action.isPending ? action.variables : undefined;

  return (
    <>
      <PageHeader
        eyebrow="F2-13 · Wizard"
        title="Validar y Compilar Modelo"
        description="Proceso controlado de pre-validación, pruebas estructurales y compilación determinista."
        actions={
          <button className="button" type="button" onClick={saveDraft}>
            <Save size={16} /> Guardar Borrador
          </button>
        }
      />
      <div className="wizard-layout">
        <aside className="wizard-steps">
          <ol>
            <li className="active">
              <CheckCircle2 />
              <span>
                Pre-validación<small>En curso</small>
              </span>
            </li>
            <li>
              <Circle />
              <span>
                Test Suite<small>Pendiente</small>
              </span>
            </li>
            <li>
              <Circle />
              <span>
                Compilación<small>Pendiente</small>
              </span>
            </li>
          </ol>
        </aside>
        <main className="wizard-main">
          <Panel title="Pre-validación del Modelo" meta="Required gate">
            <PickerSelect
              label="Versión del artefacto"
              value={versionId}
              onChange={setVersionId}
              endpoint="/v1/views/pickers/artifact-versions"
              queryKey="artifact-versions"
              placeholder="Elegir versión…"
              mapOption={(row) => ({
                value: display(row, 'id'),
                label: `${display(row, 'artifactCode')} v${display(row, 'semanticVersion')} · ${display(row, 'status')}`,
              })}
            />
            <div className="validation-group">
              <h3>
                <Code2 /> Análisis Sintáctico
              </h3>
              <ul>
                <li>
                  <CheckCircle2 /> JSON schema válido
                </li>
                <li>
                  <CheckCircle2 /> Tipos y expresiones compatibles
                </li>
                <li>
                  <CheckCircle2 /> Referencias de variables resueltas
                </li>
              </ul>
            </div>
            <div className="validation-group">
              <h3>
                <ShieldCheck /> Consistencia Lógica e Integridad
              </h3>
              <ul>
                <li>
                  <CheckCircle2 /> Nodo inicial único
                </li>
                <li>
                  <CheckCircle2 /> Rutas terminales alcanzables
                </li>
                <li>
                  <TriangleAlert /> Revisar rutas no deterministas antes de compilar
                </li>
              </ul>
            </div>
            {action.isError ? <Alert tone="error">{errorMessage(action.error)}</Alert> : null}
            <div className="wizard-actions">
              <button
                className="button"
                type="button"
                disabled={!versionId || action.isPending}
                onClick={() => action.mutate('validate')}
              >
                {pendingOperation === 'validate' ? (
                  <span className="inline-spinner" aria-hidden="true" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {pendingOperation === 'validate' ? 'Validando…' : 'Validar'}
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!versionId || action.isPending}
                onClick={() => action.mutate('compile')}
              >
                {pendingOperation === 'compile' ? (
                  <span className="inline-spinner" aria-hidden="true" />
                ) : (
                  <Play size={16} />
                )}
                {pendingOperation === 'compile' ? 'Compilando…' : 'Compilar'}
              </button>
            </div>
          </Panel>
          {action.data ? <JsonPanel label="Resultado del análisis" value={action.data} /> : null}
        </main>
      </div>
    </>
  );
}
