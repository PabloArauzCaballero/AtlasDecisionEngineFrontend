'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/http-client';

export type TutorialStatus = 'STARTED' | 'COMPLETED' | 'SKIPPED';

export interface TutorialProgress {
  tutorialId: string;
  status: TutorialStatus;
  lastStep: number;
  version: number;
  autoShow: boolean;
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

/**
 * Progreso de tutoriales por usuario. La fuente de verdad es el backend
 * (`/v1/tutorial-progress`), pero `localStorage` actúa como caché para respuesta
 * instantánea y para no perder progreso si el backend no está disponible: cada
 * cambio se guarda local primero y se intenta sincronizar; si el backend falla,
 * queda local y se reconcilia en la próxima carga con conexión.
 */
export function useTutorialProgress() {
  const [progress, setProgress] = useState<Record<string, TutorialProgress>>({});

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
    async (
      tutorialId: string,
      status: TutorialStatus,
      opts?: { lastStep?: number; version?: number; autoShow?: boolean },
    ) => {
      const entry: TutorialProgress = {
        tutorialId,
        status,
        lastStep: opts?.lastStep ?? 0,
        version: opts?.version ?? 1,
        autoShow: opts?.autoShow ?? true,
      };
      setProgress((current) => {
        const next = { ...current, [tutorialId]: entry };
        writeCache(next);
        return next;
      });
      try {
        await apiRequest(`/v1/tutorial-progress/${encodeURIComponent(tutorialId)}`, {
          method: 'PUT',
          body: {
            status: entry.status,
            lastStep: entry.lastStep,
            version: entry.version,
            autoShow: entry.autoShow,
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
    markStarted: (id: string, lastStep = 0) => save(id, 'STARTED', { lastStep }),
    saveStep: (id: string, lastStep: number) => save(id, 'STARTED', { lastStep }),
    markCompleted: (id: string) => save(id, 'COMPLETED'),
    markSkipped: (id: string) => save(id, 'SKIPPED'),
    setAutoShow: (id: string, autoShow: boolean) =>
      save(id, progress[id]?.status ?? 'STARTED', { lastStep: progress[id]?.lastStep, autoShow }),
  };
}
