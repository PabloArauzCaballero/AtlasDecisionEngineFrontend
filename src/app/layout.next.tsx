import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import '../styles/global.css';
import { THEME_BOOTSTRAP_SCRIPT } from '../theme/theme';
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

export default async function RootLayout({ children }: RootLayoutProps) {
  // Lo escribe `src/middleware.next.ts` en cada petición; sin él el script del tema
  // sería lo único que la CSP bloquearía, y volvería el destello blanco.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="es-BO" suppressHydrationWarning>
      <body>
        {/*
          Resuelve el tema antes del primer pintado para que recargar en oscuro
          no produzca un destello blanco. Va como primer hijo del <body> y no
          dentro de un <head> propio: el App Router gestiona la cabecera él
          mismo y descarta el <head> que declare un layout. Es una constante del
          propio código, no entrada del usuario, y sólo escribe un atributo del
          elemento raíz.
        */}
        {/*
          `suppressHydrationWarning` es obligatorio aquí, no cosmético: por
          seguridad el navegador vacía el atributo `nonce` del DOM en cuanto
          carga la página, así que al hidratar React compara el nonce del HTML
          contra una cadena vacía y lo denuncia como discrepancia. El script ya
          se ejecutó para entonces; no hay nada que reconciliar.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <a className="skip-link" href="#main-content">
          Saltar al contenido principal
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
