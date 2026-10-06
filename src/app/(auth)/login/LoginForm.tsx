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
import { useEnvironmentLabel } from '../../../config/EnvironmentLabelProvider';
import type { LoginProblem } from './login-errors';
import { Field } from '../../../components/Field';
import { FieldRow } from '../../../components/FieldRow';

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
  /** Abre la recuperación con lo ya escrito, para no tener que repetir tenant y correo. */
  onRecover: (identity: { tenantId: string; email: string }) => void;
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
export function LoginForm({
  initial,
  submitting,
  problem,
  notice,
  onSubmit,
  onRecover,
}: LoginFormProps) {
  const environmentLabel = useEnvironmentLabel();
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
        {environmentLabel && environmentLabel !== 'PRODUCTION' ? (
          <p className="login-environment">
            Ambiente <strong>{environmentLabel}</strong> — no es el entorno de producción.
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
        <FieldRow
          className="login-field"
          label="Correo electrónico"
          tooltip="Correo con el que te dieron de alta en la plataforma."
        >
          {(control) => (
            <>
              <div className={`input-with-icon ${emailError ? 'has-error' : ''}`}>
                <UserRound />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  placeholder="usuario@empresa.com"
                  aria-invalid={emailError}
                  id={control.id}
                  aria-describedby={['login-email-status', control['aria-describedby']]
                    .filter(Boolean)
                    .join(' ')}
                  onChange={(event) => setEmail(event.target.value)}
                  onFocus={control.onFocus}
                  onBlur={() => {
                    control.onBlur();
                    setTouched((state) => ({ ...state, email: true }));
                  }}
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
            </>
          )}
        </FieldRow>

        <FieldRow
          className="login-field"
          label="Contraseña"
          tooltip="Tu contraseña de la plataforma; nunca la compartas."
        >
          {(control) => (
            <>
              <div className={`input-with-icon ${passwordError ? 'has-error' : ''}`}>
                <KeyRound />
                <input
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  aria-invalid={passwordError}
                  id={control.id}
                  aria-describedby={['login-password-status', control['aria-describedby']]
                    .filter(Boolean)
                    .join(' ')}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={control.onFocus}
                  onBlur={() => {
                    control.onBlur();
                    setTouched((state) => ({ ...state, password: true }));
                  }}
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
            </>
          )}
        </FieldRow>

        {/*
          El número de organización casi nunca cambia (hay una sola), así que no se le pide a
          nadie en la entrada: se guarda plegado para quien opere más de una.
        */}
        <details className="login-advanced" open={tenantId !== '1' ? true : undefined}>
          <summary>Entrar en otra organización</summary>
          <Field
            className="login-field"
            label="Número de organización"
            tooltip="Sólo cambia si tu empresa opera varias organizaciones en Atlas y te dieron otro número."
          >
            <input
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              required
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            />
            <small className="login-help">
              Déjalo en 1 salvo que te hayan indicado otro número.
            </small>
          </Field>
        </details>

        <div className="login-row">
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Recordar mi correo en este equipo</span>
          </label>
          <button
            type="button"
            className="login-recover"
            onClick={() => onRecover({ tenantId, email: email.trim() })}
          >
            ¿Olvidaste tu contraseña?
          </button>
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
          Tu sesión está protegida y todo lo que hagas en el portal queda registrado con tu nombre.
        </span>
      </p>
    </section>
  );
}
