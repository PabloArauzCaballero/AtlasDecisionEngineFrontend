'use client';

import { CircleCheck, Loader2, TriangleAlert } from 'lucide-react';
import { LENGUAJES } from './language-catalog';
import type { NotebookInterpreter, RuntimeStatus } from './notebook-types';

interface RuntimeStatusBannerProps {
  motor: NotebookInterpreter;
  status: RuntimeStatus;
}

/**
 * El estado de un intérprete, dicho en voz alta.
 *
 * La primera ejecución descarga decenas de MB y tarda unos segundos. Sin este aviso, ese rato es
 * indistinguible de una celda colgada, y la reacción natural —volver a pulsar ejecutar— no acelera
 * nada. Cuando falla, se dice el comando exacto que lo arregla en vez de «no disponible»: lo que
 * falta es un artefacto que no se versiona, y quien abre la pantalla no tiene por qué saberlo.
 *
 * La frase de «listo» repite en cada caso que el código **corre en esta pestaña**. No es un adorno:
 * es la propiedad que hace aceptable que exista un cuaderno sobre datos gobernados, y es justo lo
 * que alguien no puede deducir mirando la pantalla.
 */
export function RuntimeStatusBanner({ motor, status }: RuntimeStatusBannerProps) {
  if (status.phase === 'idle') return null;
  const { label, Icon } = LENGUAJES[motor];

  /*
   * `data-language` pinta el filete del aviso con el color del intérprete, igual que la celda.
   *
   * Con dos avisos apilados —R cargando mientras Python ya está listo— es lo que permite emparejar
   * de un vistazo cada franja con las celdas a las que se refiere. El icono del lenguaje va delante
   * por lo mismo, y el estado (cargando / listo / caído) lo sigue diciendo el segundo icono y el
   * color de fondo, que es lo que no puede depender de esta marca.
   */
  if (status.phase === 'loading') {
    return (
      <p className="notebook-runtime notebook-runtime--loading" data-language={motor} role="status">
        <Icon aria-hidden="true" size={14} className="notebook-runtime__marca" />
        <Loader2 aria-hidden="true" size={14} className="notebook-cell__spin" />
        {status.detail}
      </p>
    );
  }

  if (status.phase === 'ready') {
    return (
      <p className="notebook-runtime notebook-runtime--ready" data-language={motor} role="status">
        <Icon aria-hidden="true" size={14} className="notebook-runtime__marca" />
        <CircleCheck aria-hidden="true" size={14} />
        {label} listo
        {status.packages.length ? `, con ${status.packages.join(' y ')}` : ''}. Corre en esta
        pestaña: el código no viaja a ningún servidor y no puede escribir en ninguna base.
      </p>
    );
  }

  return (
    <p
      className="notebook-runtime notebook-runtime--unavailable"
      data-language={motor}
      role="alert"
    >
      <Icon aria-hidden="true" size={14} className="notebook-runtime__marca" />
      <TriangleAlert aria-hidden="true" size={14} />
      {status.reason}
    </p>
  );
}
