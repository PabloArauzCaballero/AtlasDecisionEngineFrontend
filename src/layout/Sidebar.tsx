import { Plus, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { hasAnyRole } from '../auth/roles';
import { useAuth } from '../auth/useAuth';
import { navigation } from '../navigation/navigation';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
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
          const items = section.items.filter((item) => hasAnyRole(roles, item.roles));
          if (!items.length) return null;
          return (
            <section className="nav-section" key={section.label}>
              <p>{section.label}</p>
              {items.map(({ icon: Icon, ...item }) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
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
