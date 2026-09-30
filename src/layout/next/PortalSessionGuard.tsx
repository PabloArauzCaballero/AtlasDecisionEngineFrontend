'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type PropsWithChildren } from 'react';
import { useAuth } from '../../auth/useAuth';
import { LoadingScreen } from '../../components/LoadingScreen';

export function PortalSessionGuard({ children }: PropsWithChildren) {
  const { status, retrySession } = useAuth();
  const pathname = usePathname() ?? '/platform-health';
  const router = useRouter();

  useEffect(() => {
    if (status !== 'unauthenticated') return;

    const destination = pathname.startsWith('/') ? pathname : '/platform-health';
    router.replace(`/login?from=${encodeURIComponent(destination)}`);
  }, [pathname, router, status]);

  if (status === 'unavailable') {
    return (
      <main className="loading-screen" role="alert">
        <p>
          <strong>El motor no responde en este momento.</strong>
        </p>
        <p>
          Suele pasar mientras se actualiza y dura un par de minutos. Tu sesión sigue abierta: no
          hace falta volver a entrar.
        </p>
        <button className="button button-primary" type="button" onClick={retrySession}>
          Reintentar
        </button>
      </main>
    );
  }

  if (status !== 'authenticated') {
    return <LoadingScreen label="Validando sesión segura" />;
  }

  return children;
}
