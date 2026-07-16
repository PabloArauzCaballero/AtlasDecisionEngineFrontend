import type { ReactNode } from 'react';
import { NextAppShell } from '../../layout/next/NextAppShell';
import { PortalSessionGuard } from '../../layout/next/PortalSessionGuard';

interface PortalLayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <PortalSessionGuard>
      <NextAppShell>{children}</NextAppShell>
    </PortalSessionGuard>
  );
}
