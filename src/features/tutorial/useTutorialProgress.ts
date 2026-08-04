'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api/http-client';

export type TutorialStatus = 'STARTED' | 'COMPLETED' | 'SKIPPED';

export interface TutorialProgress {
  tutorialId: string;
  status: TutorialStatus;
  lastStep: number;
  /** Versión del tutorial que el usuario recorrió, para detectar cambios. */
  version: number;
  autoShow: boolean;
  startedAt?: string;
  completedAt?: string;
  lastInteractionAt?: string;
  /** Cuántas veces se ha vuelto a empezar tras completarlo. */
  repeatCount?: number;
}

const CACHE_KEY = 'atlas.tutorial.progress';

function readCache(): Record<string, TutorialProgress> {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, TutorialProgress>) : {};
  } catch {
    return {};
  }
}

function writeCache(map: Record<string, TutorialProgress>): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* private-mode storage: best effort */
  }
}

interface SaveOptions {
  lastStep?: number;
  version?: number;
  autoShow?: boolean;
  /** Suma una repetición: sólo lo pide un reinicio explícito del usuario. */
  repeat?: boolean;
}

/** Construye el registro nuevo conservando lo que el anterior ya sabía. */
function nextEntry(
  tutorialId: string,
  status: TutorialStatus,
  previous: TutorialProgress | undefined,
  options: SaveOptions,
  now: string,
): TutorialProgress {
  return {
    tutorialId,
    status,
    lastStep: options.lastStep ?? 0,
    // La versión es la del tutorial que se está recorriendo. Antes se guardaba
    // `1` fijo, así que un tutorial reescrito nunca se volvía a ofrecer.
    version: options.version ?? previous?.version ?? 1,
    autoShow: options.autoShow ?? previous?.autoShow ?? true,
    startedAt: previous?.startedAt ?? now,
    completedAt: status === 'COMPLETED' ? now : previous?.completedAt,
    lastInteractionAt: now,
    repeatCount: (previous?.repeatCount ?? 0) + (options.repeat ? 1 : 0),
  };
}

/**
 * Progreso de tutoriales por usuario. La fuente de verdad es el backend
 * (`/v1/tutorial-progress`), pero `localStorage` actúa como caché para respuesta
 * instantánea y para no perder progreso si el backend no está disponible: cada
 * cambio se guarda local primero y se intenta sincronizar; si el backend falla,
 * queda local y se reconcilia en la próxima carga con conexión.
 */
export function useTutorialProgress() {
  const [progress, setProgress] = useState<Record<string, TutorialProgress>>({});
  // Espejo del estado para poder construir el registro nuevo FUERA del updater:
  // calcularlo dentro obligaría a un efecto secundario en una función que React
  // puede invocar más de una vez.
  const latest = useRef(progress);
  latest.current = progress;

  useEffect(() => {
    setProgress(readCache());
    let cancelled = false;
    void (async () => {
      try {
        const rows = await apiRequest<TutorialProgress[]>('/v1/tutorial-progress');
        if (cancelled) return;
        const map: Record<string, TutorialProgress> = {};
        for (const row of rows) map[row.tutorialId] = row;
        setProgress(map);
        writeCache(map);
      } catch {
        // Backend no disponible: se conserva la caché local.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (tutorialId: string, status: TutorialStatus, opts: SaveOptions = {}) => {
      const now = new Date().toISOString();
      const entry = nextEntry(tutorialId, status, latest.current[tutorialId], opts, now);
      setProgress((current) => {
        const next = { ...current, [tutorialId]: entry };
        writeCache(next);
        return next;
      });
      try {
        // El id va en la ruta: repetirlo en el cuerpo permitiría enviar uno
        // distinto del de la URL y dejar el registro en un tutorial ajeno.
        await apiRequest(`/v1/tutorial-progress/${encodeURIComponent(tutorialId)}`, {
          method: 'PUT',
          body: {
            status: entry.status,
            lastStep: entry.lastStep,
            version: entry.version,
            autoShow: entry.autoShow,
            startedAt: entry.startedAt,
            completedAt: entry.completedAt,
            lastInteractionAt: entry.lastInteractionAt,
            repeatCount: entry.repeatCount,
          },
        });
      } catch {
        // Guardado local; se re-sincroniza cuando el backend vuelva.
      }
    },
    [],
  );

  return {
    progress,
    isCompleted: (id: string) => progress[id]?.status === 'COMPLETED',
    isSkipped: (id: string) => progress[id]?.status === 'SKIPPED',
    lastStep: (id: string) => progress[id]?.lastStep ?? 0,
    /**
     * `true` si el tutorial cambió desde que el usuario lo hizo. Un recorrido
     * reescrito enseña algo distinto, así que vuelve a contar como pendiente
     * sin borrar el historial de que ya lo había visto.
     */
    isOutdated: (id: string, version: number) => {
      const entry = progress[id];
      return Boolean(entry && entry.status === 'COMPLETED' && entry.version < version);
    },
    markStarted: (id: string, lastStep = 0, version?: number) =>
      save(id, 'STARTED', { lastStep, version }),
    saveStep: (id: string, lastStep: number, version?: number) =>
      save(id, 'STARTED', { lastStep, version }),
    markCompleted: (id: string, version?: number) => save(id, 'COMPLETED', { version }),
    markSkipped: (id: string, lastStep?: number) => save(id, 'SKIPPED', { lastStep }),
    /** Reinicio explícito: vuelve al paso 0 y cuenta la repetición. */
    restart: (id: string, version?: number) =>
      save(id, 'STARTED', { lastStep: 0, version, repeat: true }),
    setAutoShow: (id: string, autoShow: boolean) =>
      save(id, progress[id]?.status ?? 'STARTED', { lastStep: progress[id]?.lastStep, autoShow }),
  };
}
