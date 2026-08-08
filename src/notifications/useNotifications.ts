'use client';

import { useCallback, useContext, useMemo } from 'react';
import { NotificationContext } from './NotificationContext';
import type { NotificationContextValue } from './notification.types';

/** Texto fijo, o derivado del desenlace de la operación. */
type Wording<T> = string | ((value: T) => string);

export interface PromiseWording<T> {
  /** Mientras se espera. Se queda hasta que la operación termine de verdad. */
  loading: string;
  success: Wording<T>;
  /** Por omisión lo cuenta el aviso global de mutaciones fallidas. */
  error?: Wording<unknown>;
}

function say<T>(wording: Wording<T>, value: T): string {
  return typeof wording === 'function' ? wording(value) : wording;
}

export interface NotificationsApi extends NotificationContextValue {
  /**
   * Ata una operación a un único aviso: en curso mientras corre, y su desenlace
   * en la misma tarjeta.
   *
   * Existe para no poder mentir. Anunciar «guardado» junto a la llamada declara
   * el éxito antes de que el backend lo confirme, y basta un 409 para dejar en
   * pantalla un acierto que no ocurrió; aquí el texto de éxito no puede
   * escribirse hasta que la promesa se cumple.
   *
   * Deja pasar el fallo tal cual: quien llama sigue decidiendo qué hacer con él.
   */
  promise: <T>(work: Promise<T>, wording: PromiseWording<T>) => Promise<T>;
}

export function useNotifications(): NotificationsApi {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications requiere que el árbol esté dentro de NotificationProvider');
  }

  // Se desmenuza el contexto: las tres funciones son estables, el objeto que las
  // contiene no —cambia con cada aviso—. Cerrar sobre el objeto entero rehacía
  // `promise` en cada toast, y con él todo efecto que lo tuviera por dependencia.
  const { notify, update, dismiss } = context;

  const promise = useCallback(
    async <T>(work: Promise<T>, wording: PromiseWording<T>): Promise<T> => {
      const id = notify({
        tone: 'info',
        title: wording.loading,
        // Indeterminado y pegajoso: nadie sabe cuánto tarda el motor.
        progress: null,
        durationMs: null,
      });

      try {
        const value = await work;
        update(id, { tone: 'success', title: say(wording.success, value) });
        return value;
      } catch (error) {
        /*
         * Sin texto propio se RETIRA el aviso en vez de pintar uno de error: el
         * `MutationCache` de QueryProvider ya anuncia toda mutación fallida, y
         * dejar aquí un segundo mensaje contaría el mismo fallo dos veces.
         */
        if (wording.error) update(id, { tone: 'error', title: say(wording.error, error) });
        else dismiss(id);
        throw error;
      }
    },
    [dismiss, notify, update],
  );

  return useMemo(() => ({ ...context, promise }), [context, promise]);
}
