'use client';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="es-BO">
      <body>
        <main className="route-state-page">
          <h1>ATLAS no pudo iniciar correctamente</h1>
          <p>
            Se produjo un error inesperado en la interfaz. Código de diagnóstico:{' '}
            <code>{error.digest ?? 'UNAVAILABLE'}</code>
          </p>
          <button className="button button-primary" type="button" onClick={reset}>
            Reiniciar interfaz
          </button>
        </main>
      </body>
    </html>
  );
}
