import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from './AppProviders';
import '../styles/global.css';

export const metadata: Metadata = {
  title: {
    default: 'ATLAS Decision Engine',
    template: '%s · ATLAS Decision Engine',
  },
  description: 'Portal corporativo de administración y gobierno del Motor de Decisión ATLAS.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es-BO">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
