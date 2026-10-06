'use client';

import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  confirmPasswordReset as confirmReset,
  requestPasswordReset as requestReset,
} from '../../../auth/auth.api';
import type { LoginProblem } from './login-errors';
import { describeRecoveryError } from './recovery-errors';

interface RecoveryIdentity {
  tenantId: string;
  email: string;
}

interface PasswordRecoveryProps {
  initial: RecoveryIdentity;
  /** Vuelve al acceso; con `changed`, la contraseña ya se cambió para ese correo. */
  onDone: (identity: RecoveryIdentity, changed: boolean) => void;
  /** Inyectables para las pruebas; por omisión, el motor real. */
  requestPasswordReset?: typeof requestReset;
  confirmPasswordReset?: typeof confirmReset;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;
const MIN_PASSWORD = 10;

/**
 * «¿Olvidaste tu contraseña?» en dos pasos: pedir un código al correo y canjearlo por una
 * contraseña nueva.
 *
 * El primer paso dice lo mismo exista o no la cuenta —«si el correo está registrado, te llegará un
 * código»—: decir «no existe» convertiría esta pantalla en un buscador de cuentas. Por eso tampoco
 * hay un estado vacío distinto: el siguiente paso se abre siempre.
 */
export function PasswordRecovery({
  initial,
  onDone,
  requestPasswordReset = requestReset,
  confirmPasswordReset = confirmReset,
}: PasswordRecoveryProps) {
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [tenantId, setTenantId] = useState(initial.tenantId);
  const [email, setEmail] = useState(initial.email);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<LoginProblem | null>(null);
  const [resent, setResent] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Al cambiar de paso, el foco va al titular: quien navega con lector de pantalla tiene que
  // enterarse de que la pantalla cambió sin buscarlo.
  useEffect(() => heading.current?.focus(), [step]);

  const identity = { tenantId: tenantId.trim(), email: email.trim() };
  const emailError = submitted && !EMAIL_PATTERN.test(identity.email);
  const tenantError = submitted && !/^[1-9]\d*$/.test(identity.tenantId);
  const codeError = submitted && step === 'confirm' && !CODE_PATTERN.test(code);
  const passwordError = submitted && step === 'confirm' && password.length < MIN_PASSWORD;
  const repeatError = submitted && step === 'confirm' && !passwordError && repeat !== password;

  const sendCode = async (resend: boolean) => {
    setProblem(null);
    setBusy(true);
    try {
      await requestPasswordReset(identity);
      setSubmitted(false);
      setResent(resend);
      setStep('confirm');
    } catch (caught) {
      setProblem(describeRecoveryError(caught, 'request'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (busy || !EMAIL_PATTERN.test(identity.email) || !/^[1-9]\d*$/.test(identity.tenantId)) {
      return;
    }
    if (step === 'request') return sendCode(false);
    if (!CODE_PATTERN.test(code) || password.length < MIN_PASSWORD || repeat !== password) return;

    setProblem(null);
    setBusy(true);
    try {
      await confirmPasswordReset({ ...identity, code, newPassword: password });
      onDone(identity, true);
    } catch (caught) {
      // Se conserva lo escrito: un código mal tipeado no obliga a repetir la contraseña.
      setProblem(describeRecoveryError(caught, 'confirm'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="login-panel" aria-labelledby="recovery-title">
      <header className="login-panel-head">
        <p className="eyebrow">Recuperar acceso</p>
        <h1 id="recovery-title" ref={heading} tabIndex={-1}>
          {step === 'request' ? '¿Olvidaste tu contraseña?' : 'Revisa tu correo'}
        </h1>
        <p>
          {step === 'request'
            ? 'Escribe el correo de tu cuenta y te enviaremos un código de 6 dígitos para crear una contraseña nueva.'
            : `Si ${identity.email} pertenece a una cuenta activa, te enviamos un código de 6 dígitos. Puede tardar un par de minutos; revisa también la carpeta de spam.`}
        </p>
      </header>

      {resent && !problem ? (
        <p className="login-notice" role="status">
          <MailCheck size={15} aria-hidden="true" /> Pedimos un código nuevo. Usa el más reciente:
          el anterior deja de funcionar.
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

      <form onSubmit={(event) => void submit(event)} className="login-form" noValidate>
        {step === 'request' ? (
          <>
            <Field
              label="Tenant"
              id="recovery-tenant"
              error={tenantError ? 'Escribe el identificador numérico de tu organización.' : null}
            >
              <input
                id="recovery-tenant"
                inputMode="numeric"
                value={tenantId}
                aria-invalid={tenantError}
                aria-describedby="recovery-tenant-status"
                onChange={(event) => setTenantId(event.target.value)}
              />
            </Field>
            <Field
              label="Correo electrónico"
              id="recovery-email"
              error={emailError ? 'Escribe un correo con el formato usuario@empresa.com.' : null}
            >
              <input
                id="recovery-email"
                type="email"
                autoComplete="username"
                value={email}
                aria-invalid={emailError}
                aria-describedby="recovery-email-status"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field
              label="Código de 6 dígitos"
              id="recovery-code"
              error={codeError ? 'El código son exactamente 6 números.' : null}
            >
              <input
                id="recovery-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                aria-invalid={codeError}
                aria-describedby="recovery-code-status"
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field
              label="Contraseña nueva"
              id="recovery-password"
              error={passwordError ? `Usa al menos ${MIN_PASSWORD} caracteres.` : null}
              help={`Mínimo ${MIN_PASSWORD} caracteres. Al cambiarla se cierran tus sesiones abiertas.`}
            >
              <input
                id="recovery-password"
                type="password"
                autoComplete="new-password"
                value={password}
                aria-invalid={passwordError}
                aria-describedby="recovery-password-status"
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field
              label="Repite la contraseña nueva"
              id="recovery-repeat"
              error={repeatError ? 'Las dos contraseñas no coinciden.' : null}
            >
              <input
                id="recovery-repeat"
                type="password"
                autoComplete="new-password"
                value={repeat}
                aria-invalid={repeatError}
                aria-describedby="recovery-repeat-status"
                onChange={(event) => setRepeat(event.target.value)}
              />
            </Field>
          </>
        )}

        <button className="button button-primary login-submit" type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" />{' '}
              {step === 'request' ? 'Enviando código…' : 'Guardando contraseña…'}
            </>
          ) : step === 'request' ? (
            'Enviar código'
          ) : (
            'Cambiar contraseña'
          )}
        </button>
      </form>

      <div className="login-row recovery-actions">
        <button type="button" className="login-recover" onClick={() => onDone(identity, false)}>
          <ArrowLeft size={13} aria-hidden="true" /> Volver al inicio de sesión
        </button>
        {step === 'confirm' ? (
          <button
            type="button"
            className="login-recover"
            disabled={busy}
            onClick={() => void sendCode(true)}
          >
            Enviar un código nuevo
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Field({
  label,
  id,
  error,
  help,
  children,
}: {
  label: string;
  id: string;
  error: string | null;
  help?: string;
  children: ReactNode;
}) {
  // La etiqueta nombra el campo por `htmlFor` y no envolviéndolo: envuelto, el texto de ayuda
  // entraría en el nombre accesible y el lector leería «Contraseña nueva Mínimo 10 caracteres…».
  return (
    <div className={`field login-field recovery-field${error ? ' has-error' : ''}`}>
      <span>
        <label htmlFor={id}>{label}</label>
      </span>
      {children}
      <small
        id={`${id}-status`}
        className={error ? 'field-error' : 'login-help'}
        role={error ? 'alert' : undefined}
      >
        {error ?? help ?? '\u00a0'}
      </small>
    </div>
  );
}
