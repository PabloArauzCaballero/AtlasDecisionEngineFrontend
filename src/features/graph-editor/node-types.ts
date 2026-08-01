import type { LucideIcon } from 'lucide-react';
import { NODE_CATALOG } from './node-catalog';

/**
 * Iconos por tipo de nodo, derivados del catálogo visual (`node-catalog.ts`)
 * para que el icono del lienzo, el de la vista previa del importador de código
 * y el de la biblioteca de bloques no puedan divergir.
 */
export const icons = Object.fromEntries(
  Object.entries(NODE_CATALOG).map(([type, definition]) => [type, definition.icon]),
) as Record<keyof typeof NODE_CATALOG, LucideIcon>;

export const NODE_TYPES = Object.keys(NODE_CATALOG);
