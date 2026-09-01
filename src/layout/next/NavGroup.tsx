'use client';

import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { hasAnyRole } from '../../auth/roles';
import { NavLink } from '../../navigation/NavLink';
import type { NavigationItem } from '../../navigation/navigation-types';

interface NavGroupProps {
  item: NavigationItem;
  roles: string[];
  pathname: string;
  /** Cierra el cajón en móvil cuando se navega de verdad. */
  onNavigate: () => void;
  isActivePath: (pathname: string, itemPath: string) => boolean;
}

/**
 * Una entrada del menú que se despliega en sus destinos.
 *
 * Tres decisiones que no son obvias:
 *
 * 1. **La cabecera es un botón, no un enlace.** Pulsar «Workers» abre la lista;
 *    no lleva a ninguna parte. `/workers` sigue siendo una ruta válida —quien
 *    la tenga guardada entra al primer worker—, pero ofrecerla en el menú
 *    obligaría a elegir entre navegar y desplegar con el mismo clic, que es
 *    justo la ambigüedad por la que estos menús se sienten rotos.
 *
 * 2. **Se abre solo cuando estás dentro.** Entrar por `/workers/audio-tts`
 *    —desde un enlace compartido, o recargando— tiene que enseñar dónde estás;
 *    un grupo cerrado con el hijo activo escondido deja el raíl sin marcar la
 *    página actual. A partir de ahí manda lo que el usuario decida: si lo
 *    pliega estando dentro, se queda plegado.
 *
 * 3. **Plegado, la cabecera hereda el estado del hijo.** Si no, cerrar el grupo
 *    borra del raíl toda pista de en qué sección estás.
 */
export function NavGroup({ item, roles, pathname, onNavigate, isActivePath }: NavGroupProps) {
  const children = (item.children ?? []).filter((child) => hasAnyRole(roles, child.roles));
  const dentro = isActivePath(pathname, item.path);
  const [open, setOpen] = useState(dentro);
  const listId = useId();

  // Sólo fuerza la apertura al ENTRAR en el grupo, no en cada render: así un
  // pliegue manual estando dentro sobrevive a cambiar de worker.
  useEffect(() => {
    if (dentro) setOpen(true);
  }, [dentro]);

  if (children.length === 0) return null;

  const Icon = item.icon;
  const activoPlegado = dentro && !open;

  return (
    <div className={open ? 'nav-group nav-group-open' : 'nav-group'}>
      <button
        type="button"
        className={activoPlegado ? 'nav-link nav-group-head active' : 'nav-link nav-group-head'}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((visible) => !visible)}
      >
        <Icon size={18} />
        <span>{item.label}</span>
        <span className="nav-group-count">{children.length}</span>
        <ChevronRight className="nav-group-chevron" size={15} aria-hidden="true" />
      </button>
      <div className="nav-group-list" id={listId} hidden={!open}>
        {children.map(({ icon: ChildIcon, ...child }) => {
          const active = isActivePath(pathname, child.path);
          return (
            <NavLink
              key={child.path}
              href={child.path}
              onClick={onNavigate}
              className={active ? 'nav-link nav-sublink active' : 'nav-link nav-sublink'}
              aria-current={active ? 'page' : undefined}
            >
              <ChildIcon size={16} />
              <span>{child.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
