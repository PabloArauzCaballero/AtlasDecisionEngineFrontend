'use client';

import { CircleCheck, Loader2, TriangleAlert } from 'lucide-react';
import type { PythonStatus } from './notebook-types';

/**
 * El estado del intérprete de Python, dicho en voz alta.
 *
 * La primera ejecución de Python descarga 20 MB y tarda unos segundos. Sin este aviso, ese rato
 * es indistinguible de una celda colgada, y la reacción natural —volver a pulsar ejecutar— no
 * acelera nada. Cuando falla, se dice el comando exacto que lo arregla en vez de «no disponible»:
 * lo que falta es un artefacto que no se versiona, y quien abre la pantalla no tiene por qué
 * saberlo.
 */
export function PythonStatusBanner({ status }: { status: PythonStatus }) {
  if (status.phase === 'idle') return null;

  if (status.phase === 'loading') {
    return (
      <p className="notebook-python notebook-python--loading" role="status">
        <Loader2 aria-hidden="true" size={14} className="notebook-cell__spin" />
        {status.detail}
      </p>
    );
  }

  if (status.phase === 'ready') {
    return (
      <p className="notebook-python notebook-python--ready" role="status">
        <CircleCheck aria-hidden="true" size={14} />
        Python listo, con {status.packages.join(' y ')}. Corre en esta pestaña: el código no viaja a
        ningún servidor.
      </p>
    );
  }

  return (
    <p className="notebook-python notebook-python--unavailable" role="alert">
      <TriangleAlert aria-hidden="true" size={14} />
      {status.reason}
    </p>
  );
}
