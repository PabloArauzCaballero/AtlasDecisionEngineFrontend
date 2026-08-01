'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../auth/useAuth';
import { AmbientBackground } from '../../../components/AmbientBackground';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ThemeToggle } from '../../../theme/ThemeToggle';
import { LoginForm, type LoginCredentials } from './LoginForm';
import { describeLoginError, sessionNotice, type LoginProblem } from './login-errors';
import { LoginShowcase } from './LoginShowcase';

function resolveDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/platform-health';
  return value;
}

const REMEMBER_KEY = 'atlas.login.remember';

interface RememberedIdentity {
  tenantId: string;
  email: string;
}

/**
 * Sólo se recuerda el identificador de la organización y el correo, nunca la
 * contraseña ni ningún token: es una comodidad de escritorio, no un mecanismo
 * de sesión.
 */
function readRemembered(): RememberedIdentity | null {
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Partial<RememberedIdentity>;
    if (typeof record.email !== 'string') return null;
    return { tenantId: String(record.tenantId ?? '1'), email: record.email };
  } catch {
    return null;
  }
}

export function LoginClient() {
  const { status, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = resolveDestination(searchParams?.get('from') ?? null);
  const notice = sessionNotice(searchParams?.get('reason') ?? null);
  const [problem, setProblem] = useState<LoginProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remembered, setRemembered] = useState<RememberedIdentity | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace(destination);
  }, [destination, router, status]);

  // El formulario se monta con los valores por defecto y se rellena tras leer
  // el almacenamiento: así el HTML del servidor y el primer render coinciden.
  useEffect(() => {
    setRemembered(readRemembered());
    setRestored(true);
  }, []);

  if (status !== 'unauthenticated' || !restored) {
    return <LoadingScreen label="Recuperando sesión" />;
  }

  const submit = async (credentials: LoginCredentials) => {
    setProblem(null);
    setSubmitting(true);
    try {
      await login({
        tenantId: credentials.tenantId,
        email: credentials.email,
        password: credentials.password,
      });
      try {
        if (credentials.remember) {
          window.localStorage.setItem(
            REMEMBER_KEY,
            JSON.stringify({ tenantId: credentials.tenantId, email: credentials.email }),
          );
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* almacenamiento bloqueado (modo privado): no impide entrar */
      }
      router.replace(destination);
    } catch (caught) {
      setProblem(describeLoginError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page" id="main-content" tabIndex={-1}>
      <AmbientBackground variant="auth" state={problem ? 'error' : 'idle'} />
      {/* El acceso queda fuera del marco del portal, así que lleva su propio
          conmutador: quien usa tema oscuro no debería tener que autenticarse a
          plena luz para poder cambiarlo. */}
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <div className="login-layout">
        <LoginShowcase />
        <LoginForm
          initial={{
            tenantId: remembered?.tenantId ?? '1',
            email: remembered?.email ?? '',
            remember: Boolean(remembered),
          }}
          submitting={submitting}
          problem={problem}
          notice={notice}
          onSubmit={(credentials) => void submit(credentials)}
        />
      </div>
      <p className="login-foot">
        Acceso únicamente para personal autorizado · Todas las acciones son auditadas
      </p>
    </main>
  );
}
