'use client';

import { JsonPanel } from './JsonPanel';

interface DataInspectorProps {
  data: Record<string, unknown>;
  label?: string;
  /** Compat: prefijo de ids conservado por las páginas que ya lo pasan. */
  idPrefix?: string;
}

/**
 * Muestra cualquier objeto con las tres vistas complementarias de `JsonPanel`:
 * **Tabla** (atributo→valor, aplanado y legible), **Gráfico** (traza/árbol) y
 * **JSON** (crudo, para copiar). Así cada respuesta se lee de un vistazo o se
 * inspecciona al detalle, sin anidar pestañas dentro de pestañas.
 */
export function DataInspector({ data, label = 'Datos' }: DataInspectorProps) {
  return <JsonPanel value={data} label={label} />;
}
