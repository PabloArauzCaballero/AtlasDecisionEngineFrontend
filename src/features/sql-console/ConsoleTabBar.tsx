'use client';

import { Plus, X } from 'lucide-react';
import type { ConsoleTab } from './useConsoleTabs';

interface Props {
  tabs: ConsoleTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onOpen: () => void;
  onClose: (id: string) => void;
}

/**
 * La barra de pestañas del área de trabajo.
 *
 * El botón de cerrar va DENTRO de la pestaña pero es un botón aparte, no un `onClick` sobre
 * el mismo elemento: anidar dos acciones en un solo control deja al teclado sin forma de
 * elegir cuál, y cerrar por error una consulta de veinte líneas no tiene deshacer.
 *
 * El rótulo de cada pestaña sale de la primera línea útil del SQL en vez de ser «Consulta
 * 3». Con cuatro pestañas abiertas, cuatro números no distinguen nada; «SELECT artefacto,
 * estado…» sí.
 */
function rotulo(tab: ConsoleTab): string {
  const linea = tab.statement
    .split('\n')
    .map((line) => line.trim())
    // Se salta la línea de comentario: la plantilla empieza por una y todas las pestañas
    // recién abiertas de un ejemplo se llamarían igual.
    .find((line) => line.length > 0 && !line.startsWith('--'));
  if (!linea) return tab.title;
  return linea.length > 28 ? `${linea.slice(0, 28)}…` : linea;
}

export function ConsoleTabBar({ tabs, activeId, onSelect, onOpen, onClose }: Props) {
  return (
    <div className="sql-tabs" role="tablist" aria-label="Consultas abiertas">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <span key={tab.id} className={`sql-tabs__item${active ? ' is-active' : ''}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="sql-tabs__label"
              onClick={() => onSelect(tab.id)}
              title={tab.statement || tab.title}
            >
              {rotulo(tab)}
            </button>
            <button
              type="button"
              className="sql-tabs__close"
              onClick={() => onClose(tab.id)}
              aria-label={`Cerrar ${rotulo(tab)}`}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        );
      })}
      <button type="button" className="sql-tabs__open" onClick={onOpen} aria-label="Nueva consulta">
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}
