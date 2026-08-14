'use client';

import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { LoginProblem } from './login-errors';

interface LoginPinFormProps {
  email: string;
  expiresInMinutes: number;
  submitting: boolean;
  problem: LoginProblem | null;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}

const PIN_LENGTH = 6;

/** Cuenta atrás en `m:ss`. Devuelve 0 cuando el desafío ya no sirve. */
function useSecondsLeft(expiresInMinutes: number): number {
  const [deadline] = useState(() => Date.now() + expiresInMinutes * 60_000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}

/**
 * Segundo paso del acceso: el PIN que el proveedor de identidad acaba de mandar por correo.
 *
 * El campo acepta SÓLO dígitos y nada más que seis, que es exactamente lo que el motor admite:
 * dejar escribir otra cosa sólo sirve para gastar un intento de los contados que hay antes de que
 * el desafío se invalide. `autoComplete="one-time-code"` es lo que permite al teclado del móvil y a
 * los gestores de contraseñas ofrecer el código sin teclearlo.
 *
 * La cuenta atrás no es adorno: el desafío caduca, y un PIN vencido y uno equivocado dan el MISMO
 * mensaje del motor —a propósito, para no distinguirlos ante quien prueba a ciegas—. Ver el tiempo
 * restante es lo único que le dice a quien sí es la persona cuál de los dos le pasó.
 */
export function LoginPinForm({
  email,
  expiresInMinutes,
  submitting,
  problem,
  onSubmit,
  onCancel,
}: LoginPinFormProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const secondsLeft = useSecondsLeft(expiresInMinutes);
  const expired = secondsLeft === 0;
  const complete = pin.length === PIN_LENGTH;

  useEffect(() => inputRef.current?.focus(), []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!complete || expired) return;
    onSubmit(pin);
  };

  return (
    <section className="login-panel" aria-labelledby="login-pin-title">
      <header className="login-panel-head">
        <p className="eyebrow">Verificación en dos pasos</p>
        <h1 id="login-pin-title">Revisa tu correo</h1>
        <p>
          Enviamos un código de {PIN_LENGTH} dígitos a <strong>{email}</strong>. Escríbelo aquí para
          terminar de entrar.
        </p>
      </header>

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
          <span>Código de verificación</span>
          <input
            ref={inputRef}
            className="login-pin-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={PIN_LENGTH}
            value={pin}
            aria-describedby="login-pin-status"
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
          />
          <small
            id="login-pin-status"
            className={expired ? 'field-error' : 'login-help'}
            role={expired ? 'alert' : undefined}
          >
            {expired
              ? 'El código caducó. Vuelve al paso anterior para pedir uno nuevo.'
              : `El código caduca en ${formatCountdown(secondsLeft)}.`}
          </small>
        </label>

        <button
          className="button button-primary login-submit"
          type="submit"
          disabled={submitting || !complete || expired}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" /> Comprobando el código…
            </>
          ) : (
            'Confirmar acceso'
          )}
        </button>

        <button className="button login-pin-back" type="button" onClick={onCancel}>
          <ArrowLeft size={15} aria-hidden="true" /> Volver e intentar con otra cuenta
        </button>
      </form>

      <p className="login-security">
        <MailCheck size={15} aria-hidden="true" />
        <span>
          Nadie de soporte te pedirá este código. Si no pediste entrar, ignóralo y cambia tu
          contraseña.
        </span>
      </p>
    </section>
  );
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return minutes > 0 ? `${minutes}:${rest} minutos` : `${rest} segundos`;
}
