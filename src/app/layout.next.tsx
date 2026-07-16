import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/global.css';
import { AppProviders } from './AppProviders';

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
        <a className="skip-link" href="#main-content">
          Saltar al contenido principal
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
