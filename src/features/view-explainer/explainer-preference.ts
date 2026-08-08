const STORAGE_KEY = 'de.viewExplainer.open';

/**
 * Pantallas donde el banner arranca PLEGADO.
 *
 * No son vistas de lectura sino mesas de trabajo: se entra a manipular algo,
 * no a que te expliquen qué es. Medido en el editor de grafo, en una ventana de
 * 900: el banner desplegado ocupa ~290 px y empujaba el lienzo hasta y=530, con
 * lo que de un lienzo de 660 px se veían 370. La explicación no se pierde —el
 * banner sigue ahí, a un clic, y su contenido está además en el recorrido
 * guiado de la pantalla—, simplemente deja de tapar aquello que explica.
 */
const MESAS_DE_TRABAJO = new Set(['graph-editor']);

/** Sección de la que depende la explicación: el primer segmento de la ruta. */
export function explainerSection(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? '';
}

/** Estado del banner sin preferencia guardada. */
export function defaultOpen(pathname: string): boolean {
  return !MESAS_DE_TRABAJO.has(explainerSection(pathname));
}

/**
 * Preferencia guardada de una sección, o `null` si no la hay.
 *
 * Antes se guardaba un único `'1'`/`'0'` para TODO el portal: plegar el banner
 * en una pantalla lo plegaba en las cuarenta. Ahora es un mapa por sección. El
 * formato viejo se sigue leyendo como preferencia de todas ellas, para no
 * descartar en silencio la elección que alguien ya hizo.
 */
export function readPreference(pathname: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    if (raw === '1' || raw === '0') return raw === '1';
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return null;
    const value = (saved as Record<string, unknown>)[explainerSection(pathname)];
    return typeof value === 'boolean' ? value : null;
  } catch {
    // Almacenamiento bloqueado o contenido corrupto: se cae al valor por
    // defecto de la ruta en vez de romper el render de todo el portal.
    return null;
  }
}

/** Guarda la elección SÓLO para la sección donde se hizo. */
export function writePreference(pathname: string, open: boolean): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let saved: Record<string, boolean> = {};
    if (raw && raw !== '1' && raw !== '0') {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') saved = parsed as Record<string, boolean>;
    } else if (raw === '1' || raw === '0') {
      // Se conserva la elección global anterior para las demás secciones.
      saved = { ...saved };
    }
    saved[explainerSection(pathname)] = open;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Sin almacenamiento la preferencia no sobrevive a la recarga, que es
    // molesto pero no es motivo para tirar la interacción.
  }
}
