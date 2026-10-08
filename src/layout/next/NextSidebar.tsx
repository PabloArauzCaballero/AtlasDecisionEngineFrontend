'use client';

import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { hasAnyRole } from '../../auth/roles';
import { useEffectiveRoles } from '../../auth/useAuth';
import { NavLink } from '../../navigation/NavLink';
import { navigation } from '../../navigation/navigation';
import { NavGroup } from './NavGroup';

interface NextSidebarProps {
  open: boolean;
  onClose: () => void;
}

function isActivePath(pathname: string, itemPath: string): boolean {
  // El detalle de un artefacto cuelga de /artifacts, pero su entrada de menú es «Algoritmos y versiones».
  if (itemPath === '/algorithms' && pathname.startsWith('/artifacts/')) return true;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/**
 * Enlaces del menú que algún tutorial resalta. Se declaran aquí, y no con un
 * condicional en el JSX, para que añadir un objetivo nuevo no obligue a encadenar
 * ternarios dentro del render.
 */
const NAV_TUTORIAL_IDS: Readonly<Record<string, string | undefined>> = {
  '/simulator': 'nav-simulator',
};

export function NextSidebar({ open, onClose }: NextSidebarProps) {
  const pathname = usePathname() ?? '';
  const roles = useEffectiveRoles();

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand-row">
        {/* El logotipo es el acceso a Inicio, como en el ERP y el portal admin. */}
        <NavLink href="/platform-health" className="brand-link" onClick={onClose}>
          <div className="brand-mark">A</div>
          <div>
            <strong>ATLAS</strong>
            <span>Decision Engine</span>
          </div>
        </NavLink>
        <button
          className="icon-button sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar navegación"
        >
          <X />
        </button>
      </div>
      <nav aria-label="Navegación principal" data-tutorial-id="sidebar-nav">
        {navigation.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.enBarraSuperior && hasAnyRole(roles, item.roles),
          );
          if (visibleItems.length === 0) return null;

          return (
            <section className="nav-section" key={section.label}>
              <p>{section.label}</p>
              {visibleItems.map((item) => {
                // Una entrada con hijos se despliega en vez de navegar: la elección que
                // antes vivía dentro de la página (qué worker) es de navegación.
                if (item.children) {
                  return (
                    <NavGroup
                      key={item.path}
                      item={item}
                      roles={roles}
                      pathname={pathname}
                      onNavigate={onClose}
                      isActivePath={isActivePath}
                    />
                  );
                }
                const active = isActivePath(pathname, item.path);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    href={item.path}
                    onClick={onClose}
                    className={active ? 'nav-link active' : 'nav-link'}
                    aria-current={active ? 'page' : undefined}
                    data-tutorial-id={NAV_TUTORIAL_IDS[item.path]}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </section>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <span className="live-dot" /> Canal seguro activo
      </div>
    </aside>
  );
}
