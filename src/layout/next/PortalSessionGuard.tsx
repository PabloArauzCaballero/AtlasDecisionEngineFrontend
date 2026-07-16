'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type PropsWithChildren } from 'react';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../auth/useAuth';

export function PortalSessionGuard({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const pathname = usePathname();
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
