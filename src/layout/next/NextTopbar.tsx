'use client';

import { Bell, Boxes, HelpCircle, LogOut, Menu, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../auth/useAuth';
import { useTutorial } from '../../features/tutorial/useTutorial';

interface NextTopbarProps {
  onMenu: () => void;
}

export function NextTopbar({ onMenu }: NextTopbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const tutorial = useTutorial();

  const closeSession = async () => {
    await logout();
    router.replace('/login');
    router.refresh();
  };

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
      <nav className="top-links" aria-label="Accesos rápidos">
        <Link href="/platform-health">Dashboard</Link>
        <Link href="/artifacts">Workspaces</Link>
        <Link href="/coverage-matrix">Analytics</Link>
      </nav>
      <div className="topbar-spacer" />
      <div className="environment-chip">
        <span /> Production
      </div>
      <Link className="top-action" href="/simulator">
        <Boxes size={15} /> Simulate
      </Link>
      <button className="icon-button" type="button" aria-label="Notificaciones">
        <Bell />
      </button>
      <button
        className="icon-button"
        type="button"
        onClick={tutorial.start}
        aria-label="Reiniciar el tutorial guiado"
        title={tutorial.completed ? 'Reiniciar tutorial' : 'Ver tutorial'}
      >
        <HelpCircle />
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
        onClick={() => void closeSession()}
        aria-label="Cerrar sesión"
      >
        <LogOut />
      </button>
    </header>
  );
}
