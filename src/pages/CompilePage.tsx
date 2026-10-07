import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, CircleDot, Play, Pin, Send, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { NewVersionButton } from '../features/algorithms/NewVersionButton';
import { useSubmitForReview } from '../features/governance/useSubmitForReview';
import { LIFECYCLE_STEPS, lifecycleGuidance } from '../features/lifecycle/version-lifecycle';
import { ARTIFACT_STATUS_LABEL } from '../resources/artifact-status';
import { ValidationReportPanel } from '../features/lifecycle/ValidationReportPanel';
import { useNotifications } from '../notifications/useNotifications';
import { display, type UnknownRecord } from '../utils/records';

const DRAFT_KEY = 'compile-wizard-draft';

interface CompilePageProps {
  initialVersionId: string;
}

/**
 * Validar y compilar una versión.
 *
 * El asistente **sigue el estado real de la versión**. Antes ofrecía las dos
 * acciones siempre y dejaba que el motor rechazara: sobre una versión ya
 * compilada eso producía «Está desplegada o retirada: crea una versión nueva»,
 * que era falso —no estaba desplegada ni retirada— y mandaba a duplicar
 * trabajo. Y la pre-validación se pintaba con las palomitas ya puestas, sin
 * haber mirado el grafo.
 */
export function CompilePage({ initialVersionId }: CompilePageProps) {
  const [versionId, setVersionId] = useState(initialVersionId);
  const { notify } = useNotifications();

  // Restores a hand-saved draft, but never over a version arriving in the URL.
  useEffect(() => {
    if (initialVersionId) return;
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) setVersionId(draft);
  }, [initialVersionId]);

  const version = useQuery({
    queryKey: ['artifact-version', versionId],
    enabled: versionId !== '',
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodeURIComponent(versionId)}`, {
        signal,
      }),
  });
  const status = version.data ? display(version.data, 'status') : undefined;
  const guidance = lifecycleGuidance(status);
  // El estado, en español: el asistente enseñaba `COMPILED` tal cual lo manda el motor.
  const statusLabel = status ? (ARTIFACT_STATUS_LABEL[status] ?? status) : undefined;
  const review = useSubmitForReview(versionId);

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, versionId);
    notify({
      tone: 'success',
      title: 'Versión recordada',
      description: versionId
        ? `El asistente se abrirá con la versión ${versionId} ya elegida.`
        : 'El borrador quedó vacío; el asistente se abrirá sin versión.',
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
    onSuccess: (_data, operation) => {
      // El estado cambia con la operación: releerlo es lo que hace que el paso
      // siguiente se ofrezca solo, sin recargar la página.
      void version.refetch();
      notify({
        tone: 'success',
        title: operation === 'compile' ? 'Compilación completada' : 'Validación completada',
        description: `Versión ${versionId} procesada sin errores bloqueantes.`,
      });
    },
  });
  const pendingOperation = action.isPending ? action.variables : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Diseño · Asistente"
        title="Validar y compilar modelo"
        description="Proceso controlado de pre-validación, pruebas estructurales y compilación determinista."
        hint="El asistente sólo ofrece lo que el estado de la versión admite: el motor sólo compila lo que está validado, y una versión ya compilada se aprueba, no se vuelve a compilar."
        actions={
          <button
            className="button"
            type="button"
            title="La próxima vez que abras el asistente, vendrá con esta versión ya elegida. No guarda ni cambia la versión."
            onClick={saveDraft}
          >
            <Pin size={16} /> Recordar esta versión
          </button>
        }
      />
      <div className="wizard-layout">
        <div className="wizard-steps">
          <ol>
            {LIFECYCLE_STEPS.map((step, index) => {
              const done = guidance.stepIndex > index;
              const active = guidance.stepIndex === index;
              // El paso que TOCA: el siguiente al actual. Es lo que el recorrido no decía con una versión
              // recién compilada, donde lo que falta es la revisión.
              const upNext = guidance.stepIndex >= 0 && index === guidance.stepIndex + 1;
              return (
                <li key={step.id} className={active ? 'active' : done ? 'done' : ''}>
                  {done || active ? <CheckCircle2 /> : upNext ? <CircleDot /> : <Circle />}
                  <span>
                    {step.label}
                    <small>
                      {active
                        ? `Aquí está · ${statusLabel ?? ''}`
                        : done
                          ? 'Superado'
                          : upNext
                            ? `Siguiente · ${step.what}`
                            : step.what}
                    </small>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="wizard-main">
          <Panel title="Versión" meta={statusLabel ?? 'sin elegir'}>
            <ArtifactVersionPicker
              versionId={versionId}
              onVersionChange={setVersionId}
              initialVersionId={initialVersionId}
            />

            <div className={`lifecycle-state tone-${guidance.tone}`}>
              <strong>{guidance.summary}</strong>
              <p>{guidance.nextAction}</p>
              {guidance.next === 'submit-review' && !review.requestId ? (
                <button
                  className="button button-primary"
                  type="button"
                  data-tutorial-id="compile-submit-review"
                  disabled={!review.canPropose || review.pending}
                  title={
                    review.canPropose
                      ? 'Abre la solicitud de aprobación de esta versión'
                      : 'Enviar a revisión es de quien propone el cambio: analista de calidad o de fraude.'
                  }
                  onClick={review.submit}
                >
                  <Send size={16} /> {review.pending ? 'Enviando…' : 'Enviar a revisión'}
                </button>
              ) : null}
              {review.requestId ? (
                <Link
                  className="button button-primary"
                  href={`/approval-requests/${review.requestId}`}
                >
                  Ver la solicitud REQ-{review.requestId}
                </Link>
              ) : null}
              {guidance.next === 'follow-review' && !review.requestId ? (
                <Link className="button" href="/reviews">
                  Ver en Revisiones
                </Link>
              ) : null}
              {guidance.next === 'deploy' ? (
                <Link className="button button-primary" href="/deployments">
                  Ir a Despliegues
                </Link>
              ) : null}
              {guidance.next === 'edit' ? (
                <Link className="button" href={`/artifact-versions/${versionId}/graph`}>
                  Abrir el editor
                </Link>
              ) : null}
              {guidance.next === 'new-version' ? (
                <NewVersionButton
                  variant="primary"
                  sourceVersionId={versionId}
                  sourceVersion={display(version.data ?? {}, 'semanticVersion', 'versionNumber')}
                />
              ) : null}
            </div>

            {review.problem ? <Alert tone="error">{review.problem}</Alert> : null}
            {action.isError ? <Alert tone="error">{errorMessage(action.error)}</Alert> : null}
            {version.isError ? (
              <Alert tone="warning">
                No se pudo leer el estado de la versión: {errorMessage(version.error)}. Las acciones
                quedan deshabilitadas hasta saber en qué punto está.
              </Alert>
            ) : null}

            <div className="wizard-actions">
              <button
                className="button"
                type="button"
                disabled={!guidance.canValidate || action.isPending}
                title={guidance.canValidate ? undefined : guidance.nextAction}
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
                disabled={!guidance.canCompile || action.isPending}
                title={guidance.canCompile ? undefined : guidance.nextAction}
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

          {action.data && action.variables === 'validate' ? (
            <Panel title="Resultado de la validación" meta="Lo que el motor encontró">
              <ValidationReportPanel report={action.data} />
            </Panel>
          ) : null}
          {action.data && action.variables === 'compile' ? (
            <JsonPanel label="Artefacto compilado" value={action.data} />
          ) : null}
        </div>
      </div>
    </>
  );
}
