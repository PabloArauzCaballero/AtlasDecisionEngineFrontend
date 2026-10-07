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
  /**
   * Las entradas que cuelgan de ésta, si es un grupo desplegable.
   *
   * Existe porque «Workers» dejó de ser una pantalla con cinco pestañas para
   * ser cinco pantallas: la elección de worker es de NAVEGACIÓN —cambia la
   * ruta, el título y el enlace que se comparte— y estaba escondida dentro del
   * contenido, donde no se puede enlazar ni marcar como favorita.
   *
   * El padre conserva su `path`: el grupo se despliega al pulsarlo, y la ruta
   * sigue siendo válida para quien la escriba o la tenga guardada.
   */
  children?: readonly NavigationItem[];
}

export interface NavigationSection {
  label: string;
  items: readonly NavigationItem[];
}

/**
 * Una entrada que agrupa pantallas hermanas bajo una sola línea del menú.
 *
 * A diferencia de «Procesadores automáticos», el grupo no tiene pantalla propia: su `path` es el
 * de su primera pantalla —sólo identifica al grupo— y sus `roles` son la unión de los de sus
 * hijos, para que la línea salga a quien puede abrir al menos uno. Cada hijo conserva su ruta y
 * sus roles: agrupar no concede nada.
 */
export function navigationGroup(
  label: string,
  icon: LucideIcon,
  children: readonly NavigationItem[],
): NavigationItem {
  return {
    label,
    icon,
    path: children[0]?.path ?? '',
    roles: [...new Set(children.flatMap((child) => child.roles))],
    children,
  };
}
