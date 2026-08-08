import { z } from 'zod';

/**
 * Forma del progreso guardado, validada en la frontera.
 *
 * Tanto el backend como `localStorage` son entrada no confiable: el primero
 * puede cambiar de contrato y el segundo lo escribe cualquier versión anterior
 * del portal que siga viva en el navegador de alguien. Sin validar, un
 * `lastStep` que llegue como texto —o un registro a medias— se propaga hasta la
 * aritmética del Centro y sale como "paso NaN de 5".
 *
 * Se descartan las filas inválidas en lugar de romper: perder el progreso de un
 * tutorial es molesto; dejar la pantalla de aprendizaje en blanco, peor.
 */
export const tutorialProgressSchema = z.object({
  tutorialId: z.string().min(1),
  status: z.enum(['STARTED', 'COMPLETED', 'SKIPPED']),
  lastStep: z.number().int().nonnegative().catch(0),
  version: z.number().int().positive().catch(1),
  autoShow: z.boolean().catch(true),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  lastInteractionAt: z.string().optional(),
  repeatCount: z.number().int().nonnegative().optional().catch(0),
});

export type TutorialProgress = z.infer<typeof tutorialProgressSchema>;

/** Filas válidas indexadas por tutorial; las corruptas se ignoran en silencio. */
export function parseProgressRows(input: unknown): Record<string, TutorialProgress> {
  if (!Array.isArray(input)) return {};
  const map: Record<string, TutorialProgress> = {};
  for (const row of input) {
    const parsed = tutorialProgressSchema.safeParse(row);
    if (parsed.success) map[parsed.data.tutorialId] = parsed.data;
  }
  return map;
}

/** Igual, para el mapa que vive en `localStorage`. */
export function parseProgressMap(input: unknown): Record<string, TutorialProgress> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return parseProgressRows(Object.values(input as Record<string, unknown>));
}
