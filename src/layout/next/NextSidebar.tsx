'use client';

import { Boxes, GitBranch, Plus, SendHorizonal, Target, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { hasAnyRole } from '../../auth/roles';
import { canAccessPath } from '../../auth/route-access';
import { useAuth } from '../../auth/useAuth';
import { NavLink } from '../../navigation/NavLink';
import { navigation } from '../../navigation/navigation';

interface NextSidebarProps {
  open: boolean;
  onClose: () => void;
}

function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

const QUICK_ACTIONS = [
  { path: '/simulator', label: 'Ejecutar simulación', icon: Boxes },
  { path: '/reviews', label: 'Enviar a revisión', icon: SendHorizonal },
  { path: '/graph-editor', label: 'Editar grafo', icon: GitBranch },
  { path: '/objectives', label: 'Objetivos de negocio', icon: Target },
] as const;

/** Shortcut menu to the portal's most common operations, filtered by role. */
function QuickActionMenu({ roles, onNavigate }: { roles: string[]; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const actions = QUICK_ACTIONS.filter((action) => canAccessPath(action.path, roles));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className="quick-action-wrap" ref={container}>
      <button
        className="quick-action"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((visible) => !visible)}
      >
        <Plus size={17} /> Quick Action
      </button>
      {open ? (
        <div className="quick-action-menu" role="menu" aria-label="Acciones rápidas">
          {actions.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate();
                router.push(path);
              }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NextSidebar({ open, onClose }: NextSidebarProps) {
  const pathname = usePathname() ?? '';
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
      <QuickActionMenu roles={roles} onNavigate={onClose} />
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
                  <NavLink
                    key={item.path}
                    href={item.path}
                    onClick={onClose}
                    className={active ? 'nav-link active' : 'nav-link'}
                    aria-current={active ? 'page' : undefined}
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
