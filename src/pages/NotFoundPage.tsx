import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="not-found">
      <p className="eyebrow">404</p>
      <h1>Vista no encontrada</h1>
      <p>La ruta solicitada no existe en el portal.</p>
      <Link className="button button-primary" to="/platform-health">
        Volver al estado general
      </Link>
    </main>
  );
}
