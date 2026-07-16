'use client';

import { useEffect } from 'react';
import { Alert } from '../../components/Alert';

interface PortalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PortalError({ error, reset }: PortalErrorProps) {
  useEffect(() => {
    console.error('Portal route boundary captured an error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <section className="route-state-page" role="alert" aria-labelledby="portal-error-title">
      <p className="eyebrow">Error de carga</p>
      <h1 id="portal-error-title">La vista no pudo completarse</h1>
      <Alert tone="error">
        La sesión permanece protegida. Reintenta la operación o vuelve al estado de plataforma.
      </Alert>
      <button className="button button-primary" type="button" onClick={reset}>
        Reintentar
      </button>
    </section>
  );
}
