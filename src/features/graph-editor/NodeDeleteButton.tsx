'use client';

import { Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';

/**
 * Borrado de un paso del grafo, con confirmación.
 *
 * Aparte de `NodeProperties` sólo por el límite de líneas por fichero; el texto
 * de la confirmación vive con el botón porque es lo que le da sentido: sin decir
 * que se llevará por delante las conexiones, preguntar no aporta nada.
 */
export function NodeDeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <ConfirmButton
      className="button button-danger full-width"
      title={`¿Eliminar el paso «${label}»?`}
      confirmLabel="Eliminar el paso"
      description={
        <>
          <p>
            Se borra el paso y todas las conexiones que entran o salen de él. Los caminos que
            pasaban por aquí quedarán interrumpidos hasta que los vuelvas a conectar.
          </p>
          <p>El cambio no se guarda hasta que guardes el grafo, pero no se puede deshacer.</p>
        </>
      }
      onConfirm={onDelete}
    >
      <Trash2 size={14} /> Eliminar nodo
    </ConfirmButton>
  );
}
