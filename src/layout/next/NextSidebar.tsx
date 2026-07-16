'use client';

import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hasAnyRole } from '../../auth/roles';
import { useAuth } from '../../auth/useAuth';
import { navigation } from '../../navigation/navigation';

interface NextSidebarProps {
  open: boolean;
  onClose: () => void;
}

function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function NextSidebar({ open, onClose }: NextSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const roles = [...(user?.roles ?? []), ...(user?.legacyRoles ?? [])];

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand-row">
        <div className="brand-mark">A</div>
        <div>
          <strong>ATLAS</strong>
          <span>Decision Engine</span>
        </div>
        <button
          className="icon-button sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar navegación"
        >
          <X />
        </button>
      </div>
      <button className="quick-action" type="button">
        <Plus size={17} /> Quick Action
      </button>
      <nav aria-label="Navegación principal">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((item) => hasAnyRole(roles, item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <section className="nav-section" key={section.label}>
              <p>{section.label}</p>
              {visibleItems.map(({ icon: Icon, ...item }) => {
                const active = isActivePath(pathname, item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={onClose}
                    className={active ? 'nav-link active' : 'nav-link'}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
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
