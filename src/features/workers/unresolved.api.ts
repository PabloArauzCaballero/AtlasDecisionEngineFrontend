import { apiRequest } from '../../api/http-client';

/**
 * Valores que el motor no supo clasificar.
 *
 * La bandeja existe por una regla: el motor nunca inventa una categoría ni
 * pierde el dato. Cuando no alcanza la confianza necesaria guarda lo que llegó
 * —tal cual— con su mejor recomendación, y espera a que alguien decida.
 */

export interface UnresolvedItem {
  id: string;
  /** El valor exactamente como se recibió. Nunca reescrito. */
  rawValue: string;
  normalizedValue: string;
  source: string;
  context: Record<string, unknown> | null;
  suggestedCategoryCode: string | null;
  confidence: number | null;
  alternatives: { categoryCode: string; confidence: number }[] | null;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: string;
}

export type ResolutionType =
  | 'USE_SUGGESTED'
  | 'ASSIGN_EXISTING'
  | 'CREATE_CATEGORY'
  | 'CREATE_ALIAS'
  | 'DISCARD'
  | 'NOT_CATEGORIZED';

const RUTA = '/v1/workers/semantic-analysis/unresolved';

export function fetchUnresolved(search: string, signal?: AbortSignal): Promise<UnresolvedItem[]> {
  const query = search.trim() === '' ? '' : `?search=${encodeURIComponent(search.trim())}`;
  return apiRequest<UnresolvedItem[]>(`${RUTA}${query}`, { signal });
}

export function fetchUnresolvedCount(signal?: AbortSignal): Promise<{ pending: number }> {
  return apiRequest<{ pending: number }>(`${RUTA}/count`, { signal });
}

/**
 * Resuelve un pendiente. El motor aprende un alias con la decisión, así que el
 * mismo valor no vuelve a preguntarse.
 */
export function resolveUnresolved(
  id: string,
  body: { resolutionType: ResolutionType; categoryCode?: string },
): Promise<{ id: string; status: string }> {
  return apiRequest(`${RUTA}/${encodeURIComponent(id)}/resolve`, { method: 'POST', body });
}

export interface ReevaluationSummary {
  revisados: number;
  /** Cerrados por el propio catálogo, sin decisión humana. */
  resueltos: number;
  /** Siguen pendientes, pero ya con la mejor recomendación de hoy. */
  refrescados: number;
  pendientes: number;
}

export interface ReevaluationState {
  corriendo: boolean;
  pendientes: number;
  /** Resultado de la última pasada terminada, o `null` si no hubo ninguna. */
  ultima: ReevaluationSummary | null;
}

/**
 * Arranca una reevaluación de toda la bandeja con el catálogo actual.
 *
 * Lo que hoy sí se clasifica se cierra solo; lo que no, se queda con su
 * recomendación puesta al día. No escribe alias: el alias es el aprendizaje de
 * una decisión humana, y aquí no ha decidido nadie, ha mejorado el catálogo.
 *
 * **Devuelve en el acto y el trabajo sigue detrás.** Reclasificar cien términos
 * son minutos contra el modelo, muy por encima de lo que el motor deja durar a
 * una petición; esperando dentro respondía 504 con el barrido a medias, que es
 * lo peor: el trabajo continuaba y quien lo pidió creía que había fallado.
 */
export function reevaluateUnresolved(): Promise<ReevaluationState> {
  return apiRequest(`${RUTA}/reevaluate`, { method: 'POST' });
}

export function fetchReevaluationState(signal?: AbortSignal): Promise<ReevaluationState> {
  return apiRequest<ReevaluationState>(`${RUTA}/reevaluate/status`, { signal });
}
