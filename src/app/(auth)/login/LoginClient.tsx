'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isPinChallenge } from '../../../auth/auth.types';
import { useAuth } from '../../../auth/useAuth';
import { AmbientBackground } from '../../../components/AmbientBackground';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ThemeToggle } from '../../../theme/ThemeToggle';
import { LoginForm, type LoginCredentials } from './LoginForm';
import { LoginPinForm } from './LoginPinForm';
import {
  describeLoginError,
  describePinError,
  sessionNotice,
  type LoginProblem,
} from './login-errors';
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

/** El desafío de segundo factor en curso, con el correo al que se mandó el PIN. */
interface PendingChallenge {
  challengeToken: string;
  expiresInMinutes: number;
  email: string;
}

export function LoginClient() {
  const { status, login, verifyLoginPin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = resolveDestination(searchParams?.get('from') ?? null);
  const notice = sessionNotice(searchParams?.get('reason') ?? null);
  const [problem, setProblem] = useState<LoginProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remembered, setRemembered] = useState<RememberedIdentity | null>(null);
  const [restored, setRestored] = useState(false);
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  // Las credenciales del primer paso sobreviven al segundo SÓLO para poder recordar el correo si
  // así se pidió. La contraseña no se guarda: el desafío ya la sustituyó.
  const [pending, setPending] = useState<Omit<LoginCredentials, 'password'> | null>(null);

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

  /** Se recuerda al ENTRAR del todo, no al acertar la contraseña: un acceso a medias no es un acceso. */
  const rememberIdentity = (credentials: Omit<LoginCredentials, 'password'>) => {
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
  };

  const submit = async (credentials: LoginCredentials) => {
    setProblem(null);
    setSubmitting(true);
    try {
      const outcome = await login({
        tenantId: credentials.tenantId,
        email: credentials.email,
        password: credentials.password,
      });
      // Contraseña correcta pero sesión todavía no: falta el PIN del correo.
      if (isPinChallenge(outcome)) {
        // Se copian campo a campo: pasar `credentials` entero dejaría la contraseña viva en el
        // estado de React durante todo el segundo paso, sin que nadie la vuelva a necesitar.
        setPending({
          tenantId: credentials.tenantId,
          email: credentials.email,
          remember: credentials.remember,
        });
        setChallenge({
          challengeToken: outcome.challengeToken,
          expiresInMinutes: outcome.expiresInMinutes,
          email: credentials.email,
        });
        return;
      }
      rememberIdentity(credentials);
      router.replace(destination);
    } catch (caught) {
      setProblem(describeLoginError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const submitPin = async (pin: string) => {
    if (!challenge) return;
    setProblem(null);
    setSubmitting(true);
    try {
      await verifyLoginPin({ challengeToken: challenge.challengeToken, pin });
      if (pending) rememberIdentity(pending);
      router.replace(destination);
    } catch (caught) {
      setProblem(describePinError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  /* Volver descarta el desafío: reintentar la contraseña emite uno nuevo, y guardar el viejo sólo
     serviría para mandar un token que el motor ya no reconoce. */
  const cancelChallenge = () => {
    setChallenge(null);
    setPending(null);
    setProblem(null);
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
        {challenge ? (
          <LoginPinForm
            email={challenge.email}
            expiresInMinutes={challenge.expiresInMinutes}
            submitting={submitting}
            problem={problem}
            onSubmit={(pin) => void submitPin(pin)}
            onCancel={cancelChallenge}
          />
        ) : (
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
        )}
      </div>
      <p className="login-foot">
        Acceso únicamente para personal autorizado · Todas las acciones son auditadas
      </p>
    </main>
  );
}
