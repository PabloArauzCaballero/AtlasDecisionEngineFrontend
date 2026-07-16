import { Bell, Boxes, LogOut, Menu, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

interface TopbarProps {
  onMenu: () => void;
}

export function Topbar({ onMenu }: TopbarProps) {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <button
        className="icon-button menu-button"
        type="button"
        onClick={onMenu}
        aria-label="Abrir navegación"
      >
        <Menu />
      </button>
      <label className="global-search">
        <Search />
        <input aria-label="Buscar en ATLAS" placeholder="Search artifacts, requests..." />
      </label>
      <nav className="top-links">
        <Link to="/platform-health">Dashboard</Link>
        <Link to="/artifacts">Workspaces</Link>
        <Link to="/coverage-matrix">Analytics</Link>
      </nav>
      <div className="topbar-spacer" />
      <div className="environment-chip">
        <span /> Production
      </div>
      <Link className="top-action" to="/simulator">
        <Boxes size={15} /> Simulate
      </Link>
      <button className="icon-button" type="button" aria-label="Notificaciones">
        <Bell />
      </button>
      <div className="security-label">
        <ShieldCheck size={15} /> Verified
      </div>
      <div className="user-summary">
        <strong>{user?.name ?? user?.fullName}</strong>
        <span>{user?.department ?? 'ATLAS'}</span>
      </div>
      <button
        className="icon-button"
        type="button"
        onClick={() => void logout()}
        aria-label="Cerrar sesión"
      >
        <LogOut />
      </button>
    </header>
  );
}
