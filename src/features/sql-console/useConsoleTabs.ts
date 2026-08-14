'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ConsoleTab {
  id: string;
  title: string;
  statement: string;
}

const STORAGE_KEY = 'atlas.sql-console.tabs';
/** Un tope para que el almacenamiento del navegador no crezca sin fin. */
const MAX_TABS = 12;

const PLANTILLA = `-- Decisiones de los últimos 30 días, por artefacto y desenlace.
SELECT
  artefacto,
  estado,
  count(*) AS decisiones,
  round(avg(duracion_ms)) AS duracion_media_ms
FROM decisiones.ejecuciones
WHERE ejecutada_en >= now() - interval '30 days'
  AND es_produccion
GROUP BY 1, 2
ORDER BY decisiones DESC`;

function nuevaPestana(indice: number): ConsoleTab {
  return {
    // `crypto.randomUUID` no está en todos los navegadores con los que se abre el portal, y
    // un identificador repetido haría que dos pestañas compartieran estado.
    id: `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Consulta ${indice}`,
    statement: indice === 1 ? PLANTILLA : '',
  };
}

/**
 * Las pestañas de la consola, guardadas en el navegador.
 *
 * **No van al motor a propósito.** Una consulta a medio escribir es un borrador —lleva el
 * segmento que se estaba investigando, a veces un identificador— y guardarla en el servidor
 * la convertiría en un dato con dueño, retención y derecho de acceso, todo para no perder
 * un texto al recargar. La bitácora del motor registra lo que se EJECUTÓ, que es lo que hay
 * que poder auditar; lo que alguien tecleó y borró no lo es.
 *
 * Ése es también el motivo de que la ruta sea una sola (`/sql-console`) y las pestañas no
 * viajen en la URL: una URL con SQL dentro se comparte por chat, y con ella se comparte lo
 * que alguien estaba investigando.
 */
export function useConsoleTabs() {
  const [tabs, setTabs] = useState<ConsoleTab[]>([nuevaPestana(1)]);
  const [activeId, setActiveId] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);

  // Se lee en un efecto y no en el inicializador del estado: en el primer render el
  // servidor no tiene `localStorage`, y leerlo allí produce una discordancia de hidratación.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as ConsoleTab[]) : [];
      const valid = Array.isArray(saved)
        ? saved.filter(
            (tab) => tab && typeof tab.id === 'string' && typeof tab.statement === 'string',
          )
        : [];
      if (valid.length > 0) {
        setTabs(valid.slice(0, MAX_TABS));
        setActiveId(valid[0].id);
      } else {
        setTabs((current) => {
          setActiveId(current[0].id);
          return current;
        });
      }
    } catch {
      // Un almacenamiento corrupto o bloqueado no puede impedir abrir la consola: se
      // arranca con la pestaña de plantilla y se sigue.
      setTabs((current) => {
        setActiveId(current[0].id);
        return current;
      });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    } catch {
      // Modo privado o cuota agotada. Perder la persistencia no rompe la sesión en curso.
    }
  }, [tabs, hydrated]);

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  const updateStatement = useCallback((id: string, statement: string) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, statement } : tab)));
  }, []);

  const open = useCallback(() => {
    setTabs((current) => {
      if (current.length >= MAX_TABS) return current;
      const tab = nuevaPestana(current.length + 1);
      setActiveId(tab.id);
      return [...current, tab];
    });
  }, []);

  const close = useCallback((id: string) => {
    setTabs((current) => {
      // Nunca se queda sin pestañas: cerrar la última la vacía en vez de dejar la consola
      // sin editor, que es un estado del que no se sale sin recargar.
      if (current.length === 1) {
        const fresh = nuevaPestana(1);
        setActiveId(fresh.id);
        return [fresh];
      }
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      setActiveId((currentActive) =>
        currentActive === id ? (next[Math.max(0, index - 1)]?.id ?? next[0].id) : currentActive,
      );
      return next;
    });
  }, []);

  return {
    tabs,
    active,
    activeId: active?.id ?? '',
    setActiveId,
    updateStatement,
    open,
    close,
    hydrated,
  };
}
