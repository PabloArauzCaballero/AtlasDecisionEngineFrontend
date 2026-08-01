'use client';

import '../styles/global.css';
import { THEME_BOOTSTRAP_SCRIPT } from '../theme/theme';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Última red de seguridad: aparece cuando falla el propio layout raíz.
 *
 * Lo reemplaza por completo —por eso declara su `<html>` y su `<body>`—, y ahí
 * está la trampa: no hereda nada de él. Sin importar aquí la hoja de estilos y
 * sin repetir el script del tema, la pantalla que más necesita parecer
 * intencionada salía sin un solo estilo, y en blanco para quien tuviera el tema
 * oscuro puesto. Justo cuando ya ha fallado todo lo demás.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="es-BO" suppressHydrationWarning>
      <body>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <main className="route-state-page" role="alert">
          <p className="eyebrow">Error de arranque</p>
          <h1>ATLAS no pudo iniciar correctamente</h1>
          <p>
            Se produjo un error inesperado en la interfaz. Código de diagnóstico:{' '}
            <code>{error.digest ?? 'UNAVAILABLE'}</code>
          </p>
          <button className="button button-primary" type="button" onClick={reset}>
            Reiniciar interfaz
          </button>
        </main>
      </body>
    </html>
  );
}
