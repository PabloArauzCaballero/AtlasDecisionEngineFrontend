import { ShieldX } from 'lucide-react';
import Link from 'next/link';

interface ForbiddenRouteProps {
  routeRegistered: boolean;
}

export function ForbiddenRoute({ routeRegistered }: ForbiddenRouteProps) {
  return (
    <section className="route-state-page" role="alert" aria-labelledby="forbidden-title">
      <ShieldX size={42} aria-hidden="true" />
      <p className="eyebrow">403 · Acceso restringido</p>
      <h1 id="forbidden-title">
        {routeRegistered ? 'No tienes permisos para esta vista' : 'Ruta protegida no registrada'}
      </h1>
      <p>
        {routeRegistered
          ? 'Tu sesión sigue activa, pero tu rol no permite acceder a este recurso.'
          : 'La política de seguridad denegó esta ruta porque no tiene una regla de acceso explícita.'}
      </p>
      <Link className="button button-primary" href="/platform-health">
        Volver a Platform Health
      </Link>
    </section>
  );
}
