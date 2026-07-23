'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface TabDefinition {
  id: string;
  label: string;
  /** Contador opcional que se muestra como badge junto al título. */
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: readonly TabDefinition[];
  active: string;
  onChange: (id: string) => void;
  /** Render del contenido de una pestaña. Se llama por cada pestaña visitada. */
  children: (activeId: string) => ReactNode;
  /** Prefijo para los ids de aria (tab/panel). Único por instancia. */
  idPrefix?: string;
  className?: string;
}

/**
 * Pestañas accesibles y reutilizables. En vez de apilar varias tablas, cada
 * bloque de información vive en su pestaña. Las pestañas visitadas se mantienen
 * montadas y ocultas (no la activa), así conservan sus filtros/paginación y el
 * caché de React Query evita volver a pedir datos al cambiar entre ellas. La
 * primera visita monta la pestaña de forma diferida.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  children,
  idPrefix = 'tabs',
  className,
}: TabsProps) {
  const [visited, setVisited] = useState<Set<string>>(() => new Set([active]));
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    setVisited((current) => (current.has(active) ? current : new Set(current).add(active)));
  }, [active]);

  const enabled = tabs.filter((tab) => !tab.disabled);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex((tab) => tab.id === active);
    if (index === -1) return;
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabled.length - 1;
    else return;
    event.preventDefault();
    const next = enabled[(nextIndex + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.id);
    tabRefs.current.get(next.id)?.focus();
  };

  return (
    <div className={className ? `tabs ${className}` : 'tabs'}>
      <div className="tabs-list" role="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              className={selected ? 'tabs-tab active' : 'tabs-tab'}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span className="tabs-count">{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs
        .filter((tab) => visited.has(tab.id))
        .map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${idPrefix}-panel-${tab.id}`}
            aria-labelledby={`${idPrefix}-tab-${tab.id}`}
            hidden={tab.id !== active}
            className="tabs-panel"
          >
            {children(tab.id)}
          </div>
        ))}
    </div>
  );
}
