import { apiRequest } from '../../api/http-client';

/**
 * Catálogo de categorías del worker semántico: leerlo y cambiarlo.
 *
 * Es el árbol contra el que el motor clasifica, así que esto no es una pantalla
 * de mantenimiento cualquiera: cada fila que se escribe aquí cambia lo que el
 * clasificador responderá dentro de un minuto —lo que tarda en caducar su caché
 * de catálogo—, sin desplegar nada.
 */

export interface SemanticCategory {
  code: string;
  name: string;
  description: string;
  parentCode: string | null;
  positiveExamples: string[];
  counterExamples: string[];
  restrictions: string[];
  relatedCategoryCodes: string[];
  acceptanceThreshold: number;
  version: number;
  isActive: boolean;
}

/** Lo que devuelve una inyección, en seco o de verdad. */
export interface ImportSummary {
  total: number;
  created: string[];
  updated: string[];
  dryRun: boolean;
}

const RUTA = '/v1/workers/semantic-analysis/categories';

export function fetchCategories(signal?: AbortSignal): Promise<SemanticCategory[]> {
  return apiRequest<SemanticCategory[]>(RUTA, { signal });
}

/**
 * Crear y editar son la MISMA operación contra el motor, que hace `upsert` por
 * código. Separarlas en la interfaz sólo añadiría una forma de equivocarse: dos
 * botones que hacen lo mismo y un error de «ya existe» que no ayuda a nadie.
 */
export function saveCategory(categoria: Partial<SemanticCategory>): Promise<SemanticCategory> {
  return apiRequest<SemanticCategory>(`${RUTA}/${encodeURIComponent(String(categoria.code))}`, {
    method: 'PUT',
    body: categoria,
  });
}

/**
 * Baja lógica. El motor no borra la fila porque las ejecuciones ya hechas citan
 * el código con el que se decidió, y una traza que apunte al vacío no se puede
 * auditar.
 */
export function deactivateCategory(code: string): Promise<SemanticCategory> {
  return apiRequest<SemanticCategory>(`${RUTA}/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

/**
 * Inyecta un subárbol entero desde JSON.
 *
 * `dryRun` responde qué haría sin escribir. No es un lujo: pegar cientos de
 * categorías sin poder mirar antes cuáles se crean y cuáles se pisan es la clase
 * de operación que se hace una sola vez y mal.
 */
export function importCategories(categories: unknown[], dryRun: boolean): Promise<ImportSummary> {
  return apiRequest<ImportSummary>(`${RUTA}/import`, {
    method: 'POST',
    body: { categories, dryRun },
  });
}
