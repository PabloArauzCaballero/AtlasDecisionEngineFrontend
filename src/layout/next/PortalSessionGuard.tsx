'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type PropsWithChildren } from 'react';
import { useAuth } from '../../auth/useAuth';
import { LoadingScreen } from '../../components/LoadingScreen';

export function PortalSessionGuard({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const pathname = usePathname() ?? '/platform-health';
  const router = useRouter();

  useEffect(() => {
    if (status !== 'unauthenticated') return;

    const destination = pathname.startsWith('/') ? pathname : '/platform-health';
    router.replace(`/login?from=${encodeURIComponent(destination)}`);
  }, [pathname, router, status]);

  if (status !== 'authenticated') {
    return <LoadingScreen label="Validando sesión segura" />;
  }

  return children;
}
