'use client';

import { Boxes, GitBranch, Plus, SendHorizonal, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { canAccessPath } from '../../auth/route-access';
import { useEffectiveRoles } from '../../auth/useAuth';

const QUICK_ACTIONS = [
  { path: '/simulator', label: 'Ejecutar simulación', icon: Boxes },
  { path: '/reviews', label: 'Enviar a revisión', icon: SendHorizonal },
  { path: '/graph-editor', label: 'Editar grafo', icon: GitBranch },
  { path: '/objectives', label: 'Objetivos de negocio', icon: Target },
] as const;

/**
 * Atajos a las operaciones más habituales, filtrados por rol. Vive en la barra
 * superior y sólo como icono: el rótulo está en `aria-label` y en el tooltip.
 */
export function QuickActionMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const roles = useEffectiveRoles();
  const actions = QUICK_ACTIONS.filter((action) => canAccessPath(action.path, roles));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className="quick-action-wrap" ref={container}>
      <button
        className={open ? 'icon-button active' : 'icon-button'}
        type="button"
        data-tutorial-id="quick-action"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Acción rápida"
        title="Acción rápida"
        onClick={() => setOpen((visible) => !visible)}
      >
        <Plus />
      </button>
      {open ? (
        <div className="quick-action-menu" role="menu" aria-label="Acciones rápidas">
          {actions.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push(path);
              }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
