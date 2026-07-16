import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="route-state-page">
      <p className="eyebrow">404 · Ruta no encontrada</p>
      <h1>La vista solicitada no existe</h1>
      <p>Verifica la dirección o regresa al estado general de la plataforma.</p>
      <Link className="button button-primary" href="/platform-health">
        Ir a Platform Health
      </Link>
    </main>
  );
}
