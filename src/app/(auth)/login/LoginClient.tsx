'use client';

import { Eye, EyeOff, KeyRound, Network, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../../../api/ApiError';
import { useAuth } from '../../../auth/useAuth';
import { Alert } from '../../../components/Alert';
import { LoadingScreen } from '../../../components/LoadingScreen';

function resolveDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/platform-health';
  return value;
}

export function LoginClient() {
  const { status, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState('1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(resolveDestination(searchParams.get('from')));
    }
  }, [router, searchParams, status]);

  if (status !== 'unauthenticated') {
    return <LoadingScreen label="Recuperando sesión" />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ tenantId, email, password });
      router.replace(resolveDestination(searchParams.get('from')));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-grid" aria-hidden="true" />
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <div>
            <Network />
          </div>
          <h1>ATLAS</h1>
          <p>Decision Engine</p>
        </div>
        <div className="login-intro">
          <p className="eyebrow">Acceso corporativo</p>
          <h2 id="login-title">Inicia sesión</h2>
          <p>Las credenciales son verificadas por el proveedor central de identidad de ATLAS.</p>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>Tenant</span>
            <input
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              required
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Correo corporativo</span>
            <div className="input-with-icon">
              <UserRound />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@atlas.bo"
              />
            </div>
          </label>
          <label className="field">
            <span>Contraseña</span>
            <div className="input-with-icon">
              <KeyRound />
              <input
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {visible ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <div className="security-note">
            <ShieldCheck />
            <span>
              Refresh token protegido con cookie HttpOnly. El access token no se persiste en el
              navegador.
            </span>
          </div>
          <button
            className="button button-primary login-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Verificando…' : 'Autenticar'}
          </button>
        </form>
        <p className="login-foot">
          Acceso únicamente para personal autorizado · Todas las acciones son auditadas
        </p>
      </section>
    </main>
  );
}
