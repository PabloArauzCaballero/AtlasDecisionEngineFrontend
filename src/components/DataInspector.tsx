'use client';

import { useState } from 'react';
import { AttributeValueTable } from './AttributeValueTable';
import { JsonPanel } from './JsonPanel';
import { Tabs } from './Tabs';

interface DataInspectorProps {
  data: Record<string, unknown>;
  label?: string;
  /** Prefijo único de ids de aria si hay varios inspectores en la página. */
  idPrefix?: string;
}

/**
 * Muestra un objeto de dos formas, elegibles con pestañas: como **tabla
 * atributo→valor** (legible) y como **JSON** (crudo, para copiar/depurar). Así
 * cada respuesta se puede leer de un vistazo o inspeccionar al detalle.
 */
export function DataInspector({
  data,
  label = 'Datos',
  idPrefix = 'inspector',
}: DataInspectorProps) {
  const [active, setActive] = useState('attributes');
  return (
    <Tabs
      tabs={[
        { id: 'attributes', label: 'Atributos' },
        { id: 'json', label: 'JSON' },
      ]}
      active={active}
      onChange={setActive}
      idPrefix={idPrefix}
    >
      {(tab) =>
        tab === 'attributes' ? (
          <AttributeValueTable data={data} />
        ) : (
          <JsonPanel value={data} label={label} />
        )
      }
    </Tabs>
  );
}
