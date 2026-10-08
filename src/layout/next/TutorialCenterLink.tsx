'use client';

import { GraduationCap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { accessPolicies } from '../../auth/access-policies';
import { hasAnyRole } from '../../auth/roles';
import { useEffectiveRoles } from '../../auth/useAuth';
import { Tooltip } from '../../components/Tooltip';
import { NavLink } from '../../navigation/NavLink';

/**
 * El birrete de la barra superior: el acceso al Centro de tutoriales.
 *
 * Vivía como un renglón más del menú lateral, entre «Búsqueda» y «Catálogos». Pero la ayuda no es
 * una pantalla de trabajo: es algo que se busca desde cualquiera de ellas, y el sitio donde todo el
 * mundo la busca es arriba a la derecha, junto a las notificaciones y el perfil.
 *
 * Conserva `tutorial-center-link`, el ancla que el recorrido de bienvenida resalta.
 */
export function TutorialCenterLink() {
  const pathname = usePathname() ?? '';
  const roles = useEffectiveRoles();
  if (!hasAnyRole(roles, accessPolicies.tutorials)) return null;
  const active = pathname === '/tutorials';

  return (
    <Tooltip content="Tutoriales: recorridos guiados sobre el portal">
      {/* El ancla va en el envoltorio: `NavLink` no reenvía atributos `data-*` al enlace. */}
      <span className="topbar-link" data-tutorial-id="tutorial-center-link">
        <NavLink
          href="/tutorials"
          className={active ? 'icon-button active' : 'icon-button'}
          aria-label="Tutoriales"
          aria-current={active ? 'page' : undefined}
          showSpinner={false}
        >
          <GraduationCap />
        </NavLink>
      </span>
    </Tooltip>
  );
}
