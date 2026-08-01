'use client';

import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { env } from '../../../config/env';
import type { LoginProblem } from './login-errors';

export interface LoginCredentials {
  tenantId: string;
  email: string;
  password: string;
  remember: boolean;
}

interface LoginFormProps {
  initial: { tenantId: string; email: string; remember: boolean };
  submitting: boolean;
  problem: LoginProblem | null;
  notice: string | null;
  onSubmit: (credentials: LoginCredentials) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Formulario de acceso.
 *
 * La validación ocurre en cuanto el campo pierde el foco, no mientras se
 * escribe: corregir a mitad de palabra es molesto y hace parpadear el mensaje.
 * El estado de cada campo se comunica con icono + texto además del color —un
 * borde rojo solo no es un mensaje— y los errores se enlazan por
 * `aria-describedby` para que un lector de pantalla los lea al entrar al campo.
 */
export function LoginForm({ initial, submitting, problem, notice, onSubmit }: LoginFormProps) {
  const [tenantId, setTenantId] = useState(initial.tenantId);
  const [email, setEmail] = useState(initial.email);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(initial.remember);
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const passwordValid = password.length >= 1;
  const emailError = touched.email && !emailValid;
  const passwordError = touched.password && !passwordValid;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!emailValid || !passwordValid) return;
    onSubmit({ tenantId, email: email.trim(), password, remember });
  };

  return (
    <section className="login-panel" aria-labelledby="login-title">
      <header className="login-panel-head">
        <p className="eyebrow">Acceso corporativo</p>
        <h1 id="login-title">Bienvenido nuevamente</h1>
        <p>Ingresa tus credenciales para acceder a Atlas Decision Engine.</p>
        {env.environmentLabel && env.environmentLabel !== 'PRODUCTION' ? (
          <p className="login-environment">
            Ambiente <strong>{env.environmentLabel}</strong> — no es el entorno de producción.
          </p>
        ) : null}
      </header>

      {notice ? (
        <p className="login-notice" role="status">
          {notice}
        </p>
      ) : null}

      {problem ? (
        <div className={`login-problem login-problem-${problem.tone}`} role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <div>
            <strong>{problem.title}</strong>
            <p>{problem.body}</p>
            <p className="login-problem-action">{problem.action}</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={submit} className="login-form" noValidate>
        <label className="field login-field">
          <span>Tenant</span>
          <input
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            required
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          />
          <small className="login-help">Identificador de tu organización. Normalmente es 1.</small>
        </label>

        <label className="field login-field">
          <span>Correo electrónico</span>
          <div className={`input-with-icon ${emailError ? 'has-error' : ''}`}>
            <UserRound />
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              placeholder="usuario@empresa.com"
              aria-invalid={emailError}
              aria-describedby="login-email-status"
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched((state) => ({ ...state, email: true }))}
            />
            {touched.email ? (
              <span className={`field-status ${emailValid ? 'is-valid' : 'is-invalid'}`}>
                {emailValid ? <Check size={15} /> : <AlertCircle size={15} />}
              </span>
            ) : null}
          </div>
          <small
            id="login-email-status"
            className={emailError ? 'field-error' : 'login-help'}
            role={emailError ? 'alert' : undefined}
          >
            {emailError
              ? 'Escribe un correo completo, con @ y dominio (ejemplo: nombre@empresa.com).'
              : 'Usa el correo con el que te dieron de alta en la plataforma.'}
          </small>
        </label>

        <label className="field login-field">
          <span>Contraseña</span>
          <div className={`input-with-icon ${passwordError ? 'has-error' : ''}`}>
            <KeyRound />
            <input
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              aria-invalid={passwordError}
              aria-describedby="login-password-status"
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setTouched((state) => ({ ...state, password: true }))}
            />
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {visible ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <small
            id="login-password-status"
            className={passwordError ? 'field-error' : 'login-help'}
            role={passwordError ? 'alert' : undefined}
          >
            {passwordError
              ? 'Escribe tu contraseña para continuar.'
              : 'Nunca compartas tu contraseña; el equipo de soporte jamás te la pedirá.'}
          </small>
        </label>

        <div className="login-row">
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Recordar mi correo en este equipo</span>
          </label>
          <a
            className="login-recover"
            href="mailto:soporte@atlas.bo?subject=Recuperar%20contrase%C3%B1a"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <button className="button button-primary login-submit" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" /> Verificando acceso…
            </>
          ) : (
            'Iniciar sesión'
          )}
        </button>
      </form>

      <p className="login-security">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          El token de refresco viaja en una cookie HttpOnly y el token de acceso nunca se guarda en
          el navegador. Todas las acciones quedan auditadas.
        </span>
      </p>
    </section>
  );
}
