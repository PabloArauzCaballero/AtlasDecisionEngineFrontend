'use client';

import { KeyRound, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PasswordChangeDialog } from '../../auth/PasswordChangeDialog';
import { useAuth } from '../../auth/useAuth';
import { useNotifications } from '../../notifications/useNotifications';

export function initialsFrom(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Perfil en la barra superior: las iniciales abren el menú con los datos de la
 * cuenta, el cambio de contraseña y el cierre de sesión. Mismo patrón que el
 * ERP y el portal admin, para que salir se busque en el mismo sitio en los tres.
 */
export function UserMenu() {
  const { user, logout } = useAuth();
  const { notify } = useNotifications();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const displayName = user?.name || user?.fullName || 'Usuario';

  // Un menú que sólo se cierra con su botón se queda encima del contenido.
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
    <div className="user-menu" ref={container}>
      <button
        className="user-menu-trigger"
        type="button"
        data-tutorial-id="user-summary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Perfil de ${displayName}`}
        onClick={() => setOpen((visible) => !visible)}
      >
        <span className="user-avatar" aria-hidden="true">
          {initialsFrom(displayName)}
        </span>
        <span className="user-menu-name">{displayName}</span>
      </button>
      {open ? (
        <div className="user-menu-panel" role="menu" aria-label="Perfil">
          <div className="user-menu-identity">
            <strong>{displayName}</strong>
            {user?.email ? <span>{user.email}</span> : null}
            <span>{user?.department ?? 'ATLAS'}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setChangingPassword(true);
            }}
          >
            <KeyRound size={16} /> Cambiar contraseña
          </button>
          <button
            className="user-menu-danger"
            type="button"
            role="menuitem"
            data-tutorial-id="logout"
            disabled={closing}
            onClick={() => void closeSession()}
          >
            <LogOut size={16} /> {closing ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      ) : null}
      {changingPassword ? (
        <PasswordChangeDialog onClose={() => setChangingPassword(false)} />
      ) : null}
    </div>
  );
}
