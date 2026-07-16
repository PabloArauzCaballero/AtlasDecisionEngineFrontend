interface LoadingScreenProps {
  label?: string;
}

export function LoadingScreen({ label = 'Cargando' }: LoadingScreenProps) {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}
