'use client';

import { useEffect } from 'react';
import { Alert } from '../components/Alert';

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error('App Router boundary captured an error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="route-state-page">
      <Alert tone="error">
        No fue posible cargar esta sección. El incidente fue aislado para evitar perder la sesión.
      </Alert>
      <button className="button button-primary" type="button" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
