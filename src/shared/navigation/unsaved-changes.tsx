'use client';

import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ModalDialog } from '../../components/ModalDialog';

const DEFAULT_MESSAGE =
  '¿Estás seguro de que quieres dejar la pantalla inconclusa? Los cambios sin guardar se perderán.';

interface UnsavedChangesContextValue {
  setGuard: (id: string, message: string | null) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

/**
 * Intercepts in-app link navigation and page unloads while any screen reports
 * unsaved work, asking for confirmation before the user abandons it.
 */
export function UnsavedChangesProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const guardsRef = useRef(new Map<string, string>());
  const [message, setMessage] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setGuard = useCallback((id: string, guardMessage: string | null) => {
    if (guardMessage === null) guardsRef.current.delete(id);
    else guardsRef.current.set(id, guardMessage);
    const [first] = guardsRef.current.values();
    setMessage(first ?? null);
  }, []);

  useEffect(() => {
    if (!message) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const handleClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const current = window.location.pathname + window.location.search;
      const next = destination.pathname + destination.search;
      if (next === current) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(next);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClickCapture, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, [message]);

  const confirmLeave = () => {
    const href = pendingHref;
    setPendingHref(null);
    guardsRef.current.clear();
    setMessage(null);
    if (href) router.push(href);
  };

  const value = useMemo(() => ({ setGuard }), [setGuard]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {pendingHref ? (
        <ModalDialog
          title="Pantalla inconclusa"
          subtitle="Tienes cambios sin guardar"
          tone="danger"
          icon={<TriangleAlert size={20} />}
          onClose={() => setPendingHref(null)}
          actions={
            <>
              <button type="button" className="button" onClick={() => setPendingHref(null)}>
                Seguir editando
              </button>
              <button type="button" className="button button-danger" onClick={confirmLeave}>
                Salir sin guardar
              </button>
            </>
          }
        >
          <p>{message ?? DEFAULT_MESSAGE}</p>
        </ModalDialog>
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Marks the current screen as having unsaved work while `dirty` is true. The
 * provider then asks for confirmation before any in-app link navigation or
 * page unload.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string = DEFAULT_MESSAGE) {
  const context = useContext(UnsavedChangesContext);
  const id = useId();
  const setGuard = context?.setGuard;

  useEffect(() => {
    if (!setGuard) return;
    setGuard(id, dirty ? message : null);
    return () => setGuard(id, null);
  }, [dirty, id, message, setGuard]);
}
