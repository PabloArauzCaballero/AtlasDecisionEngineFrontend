'use client';

import { Boxes, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { env } from '../../config/env';
import { GlobalSearchBox } from '../../features/search/GlobalSearchBox';
import { NavLink } from '../../navigation/NavLink';
import { NotificationCenter } from '../../notifications/NotificationCenter';
import { useNotifications } from '../../notifications/useNotifications';
import { ThemeToggle } from '../../theme/ThemeToggle';

interface NextTopbarProps {
  onMenu: () => void;
}

export function NextTopbar({ onMenu }: NextTopbarProps) {
  const { user, logout } = useAuth();
  const { notify } = useNotifications();
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  const closeSession = async () => {
    // Sign-out is a redirect, so the button itself has to carry the busy state.
    setClosing(true);
    try {
      await logout();
      notify({ tone: 'info', title: 'Sesión cerrada', description: 'Tu canal seguro se liberó.' });
      router.replace('/login');
      router.refresh();
    } catch (error) {
      setClosing(false);
      notify({
        tone: 'error',
        title: 'No se pudo cerrar la sesión',
        description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      });
    }
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
      <GlobalSearchBox />
      <nav className="top-links" aria-label="Accesos rápidos">
        <NavLink href="/platform-health">Dashboard</NavLink>
        <NavLink href="/artifacts">Workspaces</NavLink>
        <NavLink href="/coverage-matrix">Analytics</NavLink>
      </nav>
      <div className="topbar-spacer" />
      {/* Antes decía "Production" siempre, incluso corriendo contra sandbox.
          Ahora se muestra el ambiente declarado en la configuración y, si no
          hay ninguno declarado, no se muestra nada: mejor un hueco que una
          afirmación falsa sobre dónde está trabajando el usuario. */}
      {env.environmentLabel ? (
        <div
          className={`environment-chip ${env.environmentLabel === 'PRODUCTION' ? '' : 'environment-nonprod'}`}
          title={
            env.environmentLabel === 'PRODUCTION'
              ? 'Estás trabajando contra el ambiente productivo.'
              : `Estás trabajando contra ${env.environmentLabel}, no contra producción.`
          }
        >
          <span /> {env.environmentLabel}
        </div>
      ) : null}
      <NavLink className="top-action" href="/simulator">
        <Boxes size={15} /> Simulate
      </NavLink>
      <ThemeToggle />
      <NotificationCenter />
      <div className="security-label">
        <ShieldCheck size={15} /> Verified
      </div>
      <div className="user-summary">
        <strong>{user?.name ?? user?.fullName}</strong>
        <span>{user?.department ?? 'ATLAS'}</span>
      </div>
      <button
        className={closing ? 'icon-button is-busy' : 'icon-button'}
        type="button"
        onClick={() => void closeSession()}
        disabled={closing}
        aria-label="Cerrar sesión"
      >
        <LogOut />
      </button>
    </header>
  );
}
