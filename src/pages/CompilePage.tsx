import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Circle, Code2, Play, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';

export function CompilePage() {
  const params = useParams();
  const [versionId, setVersionId] = useState(params.versionId ?? '');
  const action = useMutation({
    mutationFn: (operation: 'validate' | 'compile') =>
      apiRequest(`/v1/artifact-versions/${versionId}/${operation}`, { method: 'POST', body: {} }),
  });
  return (
    <>
      <PageHeader
        eyebrow="F2-13 · Wizard"
        title="Validar y Compilar Modelo"
        description="Proceso controlado de pre-validación, pruebas estructurales y compilación determinista."
        actions={
          <button className="button" type="button">
            Guardar Borrador
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
            <label className="field">
              <span>Artifact Version ID</span>
              <input
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
                placeholder="ID de la versión"
              />
            </label>
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
                <ShieldCheck size={16} /> Validar
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!versionId || action.isPending}
                onClick={() => action.mutate('compile')}
              >
                <Play size={16} /> Compilar
              </button>
            </div>
          </Panel>
          {action.data ? <JsonPanel label="Resultado del análisis" value={action.data} /> : null}
        </main>
      </div>
    </>
  );
}
