import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { canProposeArtifactChange } from '../auth/business-rules';
import { useEffectiveRoles } from '../auth/useAuth';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { ArtifactVersionPicker } from '../components/ArtifactVersionPicker';
import { PickerSelect } from '../components/PickerSelect';
import { useNotifications } from '../notifications/useNotifications';
import { display } from '../utils/records';

export function ReviewsPage() {
  const [versionId, setVersionId] = useState('');
  const [initialVersionId, setInitialVersionId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const { notify } = useNotifications();
  // Enviar una versión a revisión es el acto de PROPONER el cambio, no el de
  // aprobarlo: lo hace quien lo escribió. Quien sólo revisa o audita entra a
  // esta bandeja a consultar solicitudes, y el formulario se lo dice.
  const canPropose = canProposeArtifactChange(useEffectiveRoles());

  // Rollback on the artifact page deep-links here with the version prefilled;
  // the operator still reviews and confirms the submission by hand.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('versionId');
    if (prefill && /^[1-9][0-9]*$/.test(prefill)) setInitialVersionId(prefill);
  }, []);
  const submitReview = useMutation({
    mutationFn: (id: string) =>
      apiRequest<unknown>(`/v1/artifact-versions/${id}/submit-for-review`, {
        method: 'POST',
        body: { requireCompliance: true },
      }),
    onSuccess: (data, id) => {
      setResult(data);
      notify({
        tone: 'success',
        title: 'Versión enviada a revisión',
        description: `v${id} entró al flujo de aprobación con Compliance requerido.`,
      });
    },
  });
  const getRequest = useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/v1/approval-requests/${id}`),
    // A lookup that renders its result needs no toast — the panel is the answer.
    onSuccess: setResult,
  });
  const submit = (event: FormEvent, action: () => void) => {
    event.preventDefault();
    action();
  };
  const error = submitReview.error ?? getRequest.error;
  return (
    <>
      <PageHeader
        eyebrow="Fase 4 · Gobierno"
        title="Bandeja de revisiones"
        description="Envía versiones a aprobación y consulta el estado de cada solicitud gobernada."
      />
      <div className="two-column">
        <form
          className="panel compact-form"
          onSubmit={(event) =>
            submit(event, () => {
              if (canPropose) submitReview.mutate(versionId);
            })
          }
        >
          <h2>Enviar a revisión</h2>
          {canPropose ? null : (
            <Alert tone="info">
              Proponer un cambio requiere rol QA Analyst, Fraud Analyst o Platform Admin. Desde aquí
              puedes consultar el estado de cualquier solicitud.
            </Alert>
          )}
          <ArtifactVersionPicker
            versionId={versionId}
            onVersionChange={setVersionId}
            initialVersionId={initialVersionId}
            required
          />
          <button
            className="button button-primary"
            disabled={submitReview.isPending || !canPropose}
          >
            {submitReview.isPending ? <span className="inline-spinner" aria-hidden="true" /> : null}
            {submitReview.isPending ? 'Enviando…' : 'Enviar con Compliance'}
          </button>
        </form>
        <form
          className="panel compact-form"
          onSubmit={(event) => submit(event, () => getRequest.mutate(requestId))}
        >
          <h2>Consultar solicitud</h2>
          <PickerSelect
            label="Solicitud de aprobación"
            value={requestId}
            onChange={setRequestId}
            endpoint="/v1/approval-requests?page=1&pageSize=100"
            queryKey="approval-requests"
            required
            placeholder="Elegir solicitud…"
            mapOption={(row) => ({
              value: display(row, 'id'),
              label: `REQ-${display(row, 'id')} · ${display(row, 'artifactCode')} v${display(row, 'versionNumber')} · ${display(row, 'status')}`,
            })}
          />
          <button className="button button-primary" disabled={getRequest.isPending}>
            {getRequest.isPending ? <span className="inline-spinner" aria-hidden="true" /> : null}
            {getRequest.isPending ? 'Consultando…' : 'Consultar'}
          </button>
        </form>
      </div>
      {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}
      {result ? <JsonPanel value={result} label="Solicitud de aprobación" /> : null}
    </>
  );
}
