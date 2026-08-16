'use client';

import { useEffect, useRef } from 'react';
import { useNotifications } from '../../notifications/useNotifications';
import { avisoDeRevision } from './gloss-review';

/**
 * Avisa —una vez— de que hay glosas que se fueron a revisión.
 *
 * **Por qué un aviso y no dejarlo sólo en la tabla.** Quien lanza una
 * clasificación de doscientas glosas no se queda mirando la tabla: se va a otra
 * cosa. Si la única señal de que veinte quedaron sin resolver es una palabra en
 * una celda, no la ve nadie hasta que descubre el hueco días después, en un
 * informe. El aviso es lo que convierte «la pantalla dejó de esperar» en algo
 * que alguien SABE que ha pasado.
 *
 * **En tono informativo, nunca de error.** No ha fallado nada: el motor sigue
 * trabajando. Un toast rojo aquí enseñaría a leer como avería lo que es el
 * comportamiento correcto del sistema, y a la tercera vez se ignoraría — con lo
 * que dejaría de avisar también cuando importe.
 *
 * **Uno por tanda, y se mantiene al día.** Se levanta con la PRIMERA glosa que
 * se desvía —para poder seguir trabajando cuanto antes, que es todo el punto— y
 * a partir de ahí se actualiza el mismo aviso en lugar de apilar uno nuevo por
 * cada una. Veinte toasts idénticos tapan la pantalla, que es exactamente lo
 * contrario de liberar la interfaz.
 */
export function useAvisoDeRevision(enRevision: number): void {
  const { notify, update } = useNotifications();
  // El aviso vivo de esta tanda, y cuántas llevaba contadas.
  const aviso = useRef<{ id: string; cuantas: number } | null>(null);

  useEffect(() => {
    if (enRevision === 0) {
      // Tanda nueva —o limpiada—: el siguiente desvío levanta un aviso propio.
      aviso.current = null;
      return;
    }
    if (aviso.current === null) {
      aviso.current = {
        id: notify({ tone: 'info', ...avisoDeRevision(enRevision) }),
        cuantas: enRevision,
      };
      return;
    }
    if (aviso.current.cuantas === enRevision) return;
    aviso.current = { id: aviso.current.id, cuantas: enRevision };
    update(aviso.current.id, avisoDeRevision(enRevision));
  }, [enRevision, notify, update]);
}
