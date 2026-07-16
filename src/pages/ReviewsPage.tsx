import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';

export function ReviewsPage() {
  const [versionId, setVersionId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const submitReview = useMutation({
    mutationFn: (id: string) =>
      apiRequest<unknown>(`/v1/artifact-versions/${id}/submit-for-review`, {
        method: 'POST',
        body: { requireCompliance: true },
      }),
    onSuccess: setResult,
  });
  const getRequest = useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/v1/approval-requests/${id}`),
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
          onSubmit={(event) => submit(event, () => submitReview.mutate(versionId))}
        >
          <h2>Enviar a revisión</h2>
          <label className="field">
            <span>ID de versión</span>
            <input
              required
              pattern="[1-9][0-9]*"
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
            />
          </label>
          <button className="button button-primary">Enviar con Compliance</button>
        </form>
        <form
          className="panel compact-form"
          onSubmit={(event) => submit(event, () => getRequest.mutate(requestId))}
        >
          <h2>Consultar solicitud</h2>
          <label className="field">
            <span>ID de solicitud</span>
            <input
              required
              pattern="[1-9][0-9]*"
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
            />
          </label>
          <button className="button button-primary">Consultar</button>
        </form>
      </div>
      {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}
      {result ? <JsonPanel value={result} label="Solicitud de aprobación" /> : null}
    </>
  );
}
