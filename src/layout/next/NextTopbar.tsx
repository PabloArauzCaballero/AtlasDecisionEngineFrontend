'use client';

import { Boxes, KeyRound, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PasswordChangeDialog } from '../../auth/PasswordChangeDialog';
import { useAuth } from '../../auth/useAuth';
import { canAccessPath } from '../../auth/route-access';
import { useEffectiveRoles } from '../../auth/useAuth';
import { useEnvironmentLabel } from '../../config/EnvironmentLabelProvider';
import { GlobalSearchBox } from '../../features/search/GlobalSearchBox';
import { NavLink } from '../../navigation/NavLink';
import { NotificationCenter } from '../../notifications/NotificationCenter';
import { useNotifications } from '../../notifications/useNotifications';
import { ThemeToggle } from '../../theme/ThemeToggle';

interface NextTopbarProps {
  onMenu: () => void;
}

/** Atajos de la barra superior, con el nombre de lo que abren y no una palabra de moda en inglés. */
const TOP_SHORTCUTS = [
  { href: '/platform-health', label: 'Inicio' },
  { href: '/artifacts', label: 'Algoritmos' },
  { href: '/coverage-matrix', label: 'Cobertura' },
] as const;

export function NextTopbar({ onMenu }: NextTopbarProps) {
  const { user, logout } = useAuth();
  const { notify } = useNotifications();
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const environmentLabel = useEnvironmentLabel();
  const roles = useEffectiveRoles();
  // Un acceso que lleva a «no tienes permiso» es un botón que no funciona para quien lo pulsa.
  const shortcuts = TOP_SHORTCUTS.filter((link) => canAccessPath(link.href, roles));
  const canSimulate = canAccessPath('/simulator', roles);

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
        {shortcuts.map((link) => (
          <NavLink key={link.href} href={link.href}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="topbar-spacer" />
      {/* Antes decía "Production" siempre, incluso corriendo contra sandbox.
          Ahora se muestra el ambiente declarado en la configuración y, si no
          hay ninguno declarado, no se muestra nada: mejor un hueco que una
          afirmación falsa sobre dónde está trabajando el usuario. */}
      {environmentLabel ? (
        <div
          data-tutorial-id="environment-chip"
          className={`environment-chip ${environmentLabel === 'PRODUCTION' ? '' : 'environment-nonprod'}`}
          title={
            environmentLabel === 'PRODUCTION'
              ? 'Estás trabajando contra el ambiente productivo.'
              : `Estás trabajando contra ${environmentLabel}, no contra producción.`
          }
        >
          <span /> {environmentLabel}
        </div>
      ) : null}
      {canSimulate ? (
        <NavLink className="top-action" href="/simulator">
          <Boxes size={15} /> Simular
        </NavLink>
      ) : null}
      <ThemeToggle />
      <NotificationCenter />
      <div
        className="security-label"
        title="Entraste con contraseña y código enviado a tu correo; todo lo que hagas queda registrado."
      >
        <ShieldCheck size={15} /> Sesión protegida
      </div>
      <div className="user-summary" data-tutorial-id="user-summary">
        <strong>{user?.name ?? user?.fullName}</strong>
        <span>{user?.department ?? 'ATLAS'}</span>
      </div>
      <button
        className="icon-button"
        type="button"
        onClick={() => setChangingPassword(true)}
        aria-label="Cambiar contraseña"
        title="Cambiar contraseña"
      >
        <KeyRound />
      </button>
      <button
        className={closing ? 'icon-button is-busy' : 'icon-button'}
        type="button"
        data-tutorial-id="logout"
        onClick={() => void closeSession()}
        disabled={closing}
        aria-label="Cerrar sesión"
      >
        <LogOut />
      </button>
      {changingPassword ? (
        <PasswordChangeDialog onClose={() => setChangingPassword(false)} />
      ) : null}
    </header>
  );
}
