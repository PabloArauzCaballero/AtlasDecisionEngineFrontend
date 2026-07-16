import type { ReactNode } from 'react';
import { NextAppShell } from '../../layout/next/NextAppShell';
import { PortalSessionGuard } from '../../layout/next/PortalSessionGuard';
import { RouteAccessGuard } from '../../layout/next/RouteAccessGuard';

interface PortalLayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <PortalSessionGuard>
      <NextAppShell>
        <RouteAccessGuard>{children}</RouteAccessGuard>
      </NextAppShell>
    </PortalSessionGuard>
  );
}
