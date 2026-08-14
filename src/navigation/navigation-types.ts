import type { LucideIcon } from 'lucide-react';

/**
 * La forma del menú, aparte de su contenido.
 *
 * Vive en su propio archivo porque `navigation.ts` y `navigation-tail.ts` la comparten, y
 * hacer que la cola importe del tronco crearía una dependencia circular en cuanto el tronco
 * importe la cola —que es justo lo que hace—.
 */
export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: readonly string[];
}

export interface NavigationSection {
  label: string;
  items: readonly NavigationItem[];
}
