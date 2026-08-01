export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'atlas.theme';

/**
 * Preferencia guardada por el usuario. `system` (seguir al sistema operativo)
 * es el valor por defecto: es lo que espera quien ya configuró su equipo en
 * oscuro y no quiere repetirlo aplicación por aplicación.
 */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* almacenamiento bloqueado (modo privado): se sigue al sistema */
  }
  return 'system';
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* el tema seguirá funcionando en esta pestaña, sólo no se recordará */
  }
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/**
 * Escribe el tema resuelto en el elemento raíz.
 *
 * Siempre se escribe un valor concreto (`light` o `dark`), nunca `system`: las
 * hojas de estilo consultan `[data-theme='dark']` y no tienen por qué saber si
 * ese oscuro lo eligió la persona o su sistema operativo.
 */
export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

/**
 * Script que se inyecta en el HTML y corre antes del primer pintado.
 *
 * Sin él, la página se pintaría en claro y saltaría a oscuro al hidratar: un
 * destello blanco a pantalla completa, justo lo que quien usa tema oscuro está
 * evitando. Va como cadena porque debe ejecutarse antes que cualquier bundle, y
 * como sólo toca un atributo del `<html>` —que React no renderiza— no genera
 * discrepancia de hidratación.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
var p=localStorage.getItem('${THEME_STORAGE_KEY}');
var d=p==='dark'||((p===null||p==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.dataset.theme=d?'dark':'light';
}catch(e){document.documentElement.dataset.theme='light';}})();`;
