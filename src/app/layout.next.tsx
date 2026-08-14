import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import '../styles/global.css';
import { THEME_BOOTSTRAP_SCRIPT } from '../theme/theme';
import { AppProviders } from './AppProviders';

/**
 * La tipografía del portal, servida por nosotros.
 *
 * `foundation.css` pedía `Inter` desde el principio, pero NADIE la cargaba: no
 * había `next/font`, ni `@font-face`, ni `public/`. El primer nombre de la pila
 * no resolvía y el portal entero se pintaba con el siguiente que sí existe —en
 * Windows, Segoe UI—. La jerarquía tipográfica estaba diseñada contra una fuente
 * que no llegaba nunca a la pantalla.
 *
 * `next/font` la descarga en tiempo de compilación y la sirve desde el mismo
 * origen, así que no hay petición a un tercero en tiempo de ejecución: la CSP
 * (`font-src 'self' data:`) la admite sin abrirle la mano a Google, y no se filtra
 * la IP de quien usa el portal. `display: 'swap'` evita el texto invisible
 * mientras carga.
 *
 * Se expone como variable CSS en vez de como clase para que la pila de respaldo
 * siga viviendo en `foundation.css`, junto al resto de los fundamentos.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'ATLAS Decision Engine',
    template: '%s · ATLAS Decision Engine',
  },
  description: 'Portal corporativo de administración y gobierno del Motor de Decisión ATLAS.',
};

/**
 * Ventana gráfica.
 *
 * No existía, así que Next emitía su valor por omisión. Aquí se declara por dos
 * motivos que no son de estilo:
 *
 * 1. `userScalable: true` y **sin** `maximumScale`. Bloquear el zoom incumple
 *    WCAG 1.4.4 (redimensionar texto hasta el 200 %) y es la forma más rápida de
 *    dejar fuera a quien no ve de cerca. Se declara explícitamente para que
 *    nadie lo «arregle» más adelante añadiendo un tope.
 *
 * 2. `viewportFit: 'cover'` extiende la página bajo la muesca y las esquinas
 *    redondeadas de los teléfonos que las tienen. Por sí solo eso METERÍA
 *    contenido debajo del recorte; va acompañado —obligatoriamente— de los
 *    `env(safe-area-inset-*)` de `parts/responsive-tokens.css`, que devuelven
 *    ese margen donde hace falta. Los dos cambios son uno solo: aplicar este sin
 *    aquéllos deja el cajón de navegación bajo la barra de estado.
 *
 * En un dispositivo sin muesca todos los `env()` valen 0 y nada cambia.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  // Lo escribe `src/middleware.next.ts` en cada petición; sin él el script del tema
  // sería lo único que la CSP bloquearía, y volvería el destello blanco.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="es-BO" className={inter.variable} suppressHydrationWarning>
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
