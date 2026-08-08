'use client';

import Link, { useLinkStatus } from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ModalDialog } from '../components/ModalDialog';
import { useUnsavedWorkGuard } from './UnsavedWorkProvider';
import { useNavigationProgress } from './useNavigationProgress';

/**
 * Reports this link's navigation state upward and renders an inline spinner.
 *
 * `useLinkStatus` only reports from inside a `<Link>`, so this has to be a
 * child component rather than a hook call in `NavLink` itself.
 */
function LinkPendingIndicator({ showSpinner }: { showSpinner: boolean }) {
  const { pending } = useLinkStatus();
  const { setPending } = useNavigationProgress();
  const id = useId();

  useEffect(() => {
    setPending(id, pending);
    // Unmounting mid-navigation must not leave the progress bar running.
    return () => setPending(id, false);
  }, [id, pending, setPending]);

  if (!pending || !showSpinner) return null;
  return <span className="inline-spinner nav-link-spinner" aria-hidden="true" />;
}

interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  'aria-current'?: 'page';
  /** Renders a spinner in the link while its route loads. */
  showSpinner?: boolean;
}

/**
 * A `<Link>` that feeds the shared route progress bar and shows its own
 * pending state, so a click on a slow route is acknowledged immediately.
 *
 * **Y pregunta antes de tirar trabajo empezado.** Medido en el navegador:
 * cambiar de pestaña dentro de una vista conserva lo escrito, pero salir de la
 * ruta por el cajón desmonta el componente y se lo lleva. Como salir es
 * justamente lo que se hace de un clic distraído, la confirmación vive aquí —en
 * el enlace— y no en las pestañas, donde no habría nada que perder.
 */
export function NavLink({
  href,
  children,
  className,
  onClick,
  showSpinner = true,
  'aria-current': ariaCurrent,
}: NavLinkProps) {
  const pendientes = useUnsavedWorkGuard();
  const [preguntando, setPreguntando] = useState(false);

  return (
    <>
      <Link
        href={href}
        className={className}
        aria-current={ariaCurrent}
        onClick={(event) => {
          if (pendientes.length > 0) {
            event.preventDefault();
            setPreguntando(true);
            return;
          }
          onClick?.();
        }}
      >
        {children}
        <LinkPendingIndicator showSpinner={showSpinner} />
      </Link>

      {preguntando ? (
        <ModalDialog
          title="Tienes trabajo sin enviar"
          subtitle="Si sales de esta vista se pierde."
          tone="danger"
          onClose={() => setPreguntando(false)}
          actions={
            <>
              {/*
               * «Quedarme» va primero y es la acción segura: quien pulsa Intro
               * sin leer no debe perder nada. Salir exige elegirlo.
               */}
              <button type="button" className="button" onClick={() => setPreguntando(false)}>
                Quedarme aquí
              </button>
              {/*
               * Un enlace de verdad y no `router.push`. `useRouter()` exige que
               * el App Router esté montado, y `NavLink` se renderiza también en
               * pruebas unitarias de componentes que no lo montan: la llamada
               * las tumbaba todas con «invariant expected app router to be
               * mounted». Un `<Link>` navega igual, respeta abrir en otra
               * pestaña con Ctrl y no ata este componente al contexto de rutas.
               */}
              <Link
                href={href}
                className="button button-danger"
                onClick={() => {
                  setPreguntando(false);
                  onClick?.();
                }}
              >
                Salir y perderlo
              </Link>
            </>
          }
        >
          <ul className="unsaved-work-list">
            {pendientes.map((pendiente) => (
              <li key={pendiente}>{pendiente}</li>
            ))}
          </ul>
        </ModalDialog>
      ) : null}
    </>
  );
}
