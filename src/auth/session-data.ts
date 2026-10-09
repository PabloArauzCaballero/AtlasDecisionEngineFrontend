/**
 * Datos de trabajo que el portal deja en el navegador y que NO pueden sobrevivir a la sesión.
 *
 * El portal se usa en estaciones compartidas por turnos (ver `AuthProvider`). Dos cosas se
 * guardaban fuera de la memoria y seguían ahí para la siguiente persona:
 *
 * - El SQL de las pestañas de la consola (`localStorage`): un `WHERE ci = '…'` es un dato de
 *   cliente.
 * - La copia de la entrada de una ejecución que se manda al simulador (`sessionStorage`): el
 *   expediente en claro, si nadie llegó a abrir el simulador.
 *
 * Se borran al cerrar o vencer la sesión, junto a la caché de React Query.
 */

export const SQL_CONSOLE_TABS_KEY = 'atlas.sql-console.tabs';
export const SIMULATOR_PREFILL_KEY = 'simulator-prefill';

export function clearSessionData(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SQL_CONSOLE_TABS_KEY);
  } catch {
    // Almacenamiento bloqueado: no hay nada que borrar ahí.
  }
  try {
    window.sessionStorage.removeItem(SIMULATOR_PREFILL_KEY);
  } catch {
    // Ídem.
  }
}
