import type { ReactNode } from 'react';
import { NextAppShell } from '../../layout/next/NextAppShell';
import { PortalSessionGuard } from '../../layout/next/PortalSessionGuard';
import { RouteAccessGuard } from '../../layout/next/RouteAccessGuard';
import { UnsavedWorkProvider } from '../../navigation/UnsavedWorkProvider';

interface PortalLayoutProps {
  children: ReactNode;
}

/**
 * `UnsavedWorkProvider` envuelve al armazón, no a la ruta: quien pregunta antes
 * de tirar trabajo es el cajón de navegación, que vive en el armazón. Colgado
 * por dentro de `RouteAccessGuard` se desmontaría con cada cambio de ruta y
 * olvidaría lo que había que proteger justo al navegar.
 */
export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <PortalSessionGuard>
      <UnsavedWorkProvider>
        <NextAppShell>
          <RouteAccessGuard>{children}</RouteAccessGuard>
        </NextAppShell>
      </UnsavedWorkProvider>
    </PortalSessionGuard>
  );
}
