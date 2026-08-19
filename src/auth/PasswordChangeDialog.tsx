'use client';

import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ModalDialog } from '../components/ModalDialog';
import { confirmPasswordChange, requestPasswordChange } from './auth.api';
import type { PinChallenge } from './auth.types';
import { useAuth } from './useAuth';

/**
 * Cambio de contraseña de quien ya está dentro, en dos pasos y con el mismo
 * segundo factor por correo que el acceso.
 *
 * Hasta ahora el portal sabía AVISAR de que una contraseña estaba marcada para
 * cambio (`SessionSecurityNotice`) y remitía «al proveedor de identidad», donde
 * no había ningún endpoint con el que hacerlo: el aviso no tenía salida y la
 * contraseña temporal —la que viajó por correo— seguía siendo la buena
 * indefinidamente. Esto es esa salida.
 *
 * Al confirmarse, el motor revoca TODAS las sesiones de la cuenta, incluida
 * ésta. La pantalla lo dice antes de empezar y cierra sesión al terminar, en vez
 * de dejar el portal disparando llamadas que ya devuelven 401.
 */
export function PasswordChangeDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const { logout } = useAuth();
  const [challenge, setChallenge] = useState<PinChallenge | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setChallenge(await requestPasswordChange(currentPassword));
      setCurrentPassword('');
    } catch (requestError) {
      setError(describe(requestError, 'No fue posible enviar el código.'));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    // Se comprueba antes de gastar el código: descubrir un error de tecleo
    // después de canjearlo obliga a esperar el minuto de espera para pedir otro.
    if (newPassword !== repeatPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await confirmPasswordChange({ challengeToken: challenge.challengeToken, code, newPassword });
      await logout();
    } catch (confirmError) {
      setError(describe(confirmError, 'No fue posible cambiar la contraseña.'));
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <ModalDialog
        title="Confirma tu contraseña nueva"
        subtitle={`Enviamos un código de 6 dígitos a tu correo. Vence en ${challenge.expiresInMinutes} minutos.`}
        icon={<KeyRound size={18} aria-hidden="true" />}
        onClose={onClose}
      >
        <form className="password-change-form" onSubmit={(event) => void onConfirm(event)}>
          <label>
            <span>Código del correo</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </label>
          <label>
            <span>Contraseña nueva</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              required
            />
            <small>Mínimo 10 caracteres, con al menos una letra y un número o símbolo.</small>
          </label>
          <label>
            <span>Repite la contraseña nueva</span>
            <input
              type="password"
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error ? (
            <p className="password-change-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Cambiar contraseña y cerrar sesión'}
          </button>
        </form>
      </ModalDialog>
    );
  }

  return (
    <ModalDialog
      title="Cambiar contraseña"
      subtitle="Te enviaremos un código al correo de tu cuenta. Al terminar se cerrarán todas tus sesiones."
      icon={<KeyRound size={18} aria-hidden="true" />}
      onClose={onClose}
    >
      <form className="password-change-form" onSubmit={(event) => void onRequest(event)}>
        <label>
          <span>Contraseña actual</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p className="password-change-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviarme el código'}
        </button>
      </form>
    </ModalDialog>
  );
}

function describe(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
