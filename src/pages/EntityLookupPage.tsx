import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';

interface EntityLookupPageProps {
  eyebrow: string;
  title: string;
  description: string;
  idLabel: string;
  endpoint: (id: string) => string;
}

export function EntityLookupPage({
  eyebrow,
  title,
  description,
  idLabel,
  endpoint,
}: EntityLookupPageProps) {
  const [id, setId] = useState('');
  const lookup = useMutation({
    mutationFn: (value: string) => apiRequest<unknown>(endpoint(value)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    lookup.mutate(id);
  };
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <form className="filter-bar" onSubmit={submit}>
        <label>
          <span>{idLabel}</span>
          <input
            required
            pattern="[1-9][0-9]*"
            value={id}
            onChange={(event) => setId(event.target.value)}
          />
        </label>
        <button className="button button-primary" type="submit" disabled={lookup.isPending}>
          Consultar
        </button>
      </form>
      {lookup.isError ? <Alert tone="error">{errorMessage(lookup.error)}</Alert> : null}
      {lookup.data ? (
        <JsonPanel value={lookup.data} label="Detalle" />
      ) : (
        <section className="panel empty-state">
          <p>Ingresa un identificador para consultar el registro.</p>
        </section>
      )}
    </>
  );
}
