'use client';

import { Search } from 'lucide-react';
import { accessPolicies } from '../../auth/access-policies';
import { hasAnyRole } from '../../auth/roles';
import { useEffectiveRoles } from '../../auth/useAuth';
import { NavLink } from '../../navigation/NavLink';

/**
 * La lupa que sustituye a la caja de búsqueda cuando la barra no tiene sitio para ella.
 *
 * «Búsqueda» era un renglón del menú lateral sólo por esto: por debajo de 820 px la caja de la
 * barra superior se oculta y `/search` se quedaba sin ningún acceso. Con la lupa aquí, el renglón
 * sobra en escritorio —donde la caja ya está a la vista— y el teléfono conserva su camino.
 *
 * Sólo se pinta en estrecho (`responsive.css`): en ancho sería la misma búsqueda dos veces seguidas.
 */
export function TopbarSearchLink() {
  const roles = useEffectiveRoles();
  if (!hasAnyRole(roles, accessPolicies.globalSearch)) return null;

  return (
    <span className="topbar-search-link">
      <NavLink href="/search" className="icon-button" aria-label="Buscar" showSpinner={false}>
        <Search />
      </NavLink>
    </span>
  );
}
