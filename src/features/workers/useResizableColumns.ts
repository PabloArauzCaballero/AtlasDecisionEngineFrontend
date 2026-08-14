'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Anchos de columna que el usuario ajusta arrastrando la línea de la cabecera.
 *
 * **Por qué hace falta.** La glosa de un extracto puede ser «AGENCIA» o llevar
 * cuenta destino, nombre y banco; cualquier reparto fijo se equivoca con la
 * mitad de los documentos. Quien mira la tabla sabe qué columna necesita ancha
 * hoy, y es una decisión que cambia entre un extracto y el siguiente.
 *
 * **Se guarda en el navegador, por tabla.** El ajuste es una preferencia de
 * quien mira, no un dato del extracto: no viaja al servidor y no se comparte.
 * Si el almacenamiento no está disponible —modo privado, política del
 * navegador—, la tabla sigue funcionando y sólo se pierde la memoria entre
 * visitas; por eso nada aquí lanza.
 */

/** Por debajo de esto una columna deja de leerse y sólo estorba. */
const MINIMO_PX = 64;

function clave(tabla: string): string {
  return `atlas:anchos:${tabla}`;
}

function leer(tabla: string): Record<string, number> {
  try {
    const guardado = window.localStorage.getItem(clave(tabla));
    if (guardado === null) return {};
    const dato: unknown = JSON.parse(guardado);
    if (typeof dato !== 'object' || dato === null) return {};
    return Object.fromEntries(
      Object.entries(dato as Record<string, unknown>).filter(
        (par): par is [string, number] => typeof par[1] === 'number' && par[1] >= MINIMO_PX,
      ),
    );
  } catch {
    return {};
  }
}

function guardar(tabla: string, anchos: Record<string, number>): void {
  try {
    window.localStorage.setItem(clave(tabla), JSON.stringify(anchos));
  } catch {
    // Sin almacenamiento el ajuste sigue valiendo para esta sesión.
  }
}

export interface ColumnasAjustables {
  /** Ancho fijado para una columna, o `undefined` si nunca se tocó. */
  anchoDe: (columna: string) => number | undefined;
  /** Handler del tirador de una columna. Sirve para ratón y para táctil. */
  empezar: (columna: string) => (evento: React.PointerEvent<HTMLElement>) => void;
  /** Ajuste con las flechas, para quien no usa ratón. */
  conTeclado: (columna: string) => (evento: React.KeyboardEvent<HTMLElement>) => void;
  /** Devuelve todas las columnas a su ancho automático. */
  restablecer: () => void;
  /** Hay al menos un ancho fijado a mano. */
  ajustada: boolean;
}

export function useResizableColumns(tabla: string): ColumnasAjustables {
  // Lectura perezosa: `localStorage` no existe durante el render del servidor.
  const [anchos, setAnchos] = useState<Record<string, number>>(() =>
    typeof window === 'undefined' ? {} : leer(tabla),
  );
  const arrastre = useRef<{ columna: string; desdeX: number; desdeAncho: number } | null>(null);

  const empezar = useCallback(
    (columna: string) => (evento: React.PointerEvent<HTMLElement>) => {
      /*
       * El ancho de partida se mide sobre la celda REAL —la que el navegador
       * acaba de disponer—, no sobre el valor guardado: la primera vez no hay
       * valor guardado, y arrancar de cero haría saltar la columna al mínimo en
       * cuanto se toca el tirador.
       */
      const celda = evento.currentTarget.closest('th');
      if (!(celda instanceof HTMLElement)) return;
      evento.preventDefault();
      evento.currentTarget.setPointerCapture(evento.pointerId);
      arrastre.current = {
        columna,
        desdeX: evento.clientX,
        desdeAncho: celda.getBoundingClientRect().width,
      };

      const mover = (movimiento: PointerEvent) => {
        const actual = arrastre.current;
        if (actual === null) return;
        const ancho = Math.max(MINIMO_PX, actual.desdeAncho + (movimiento.clientX - actual.desdeX));
        setAnchos((previos) => ({ ...previos, [actual.columna]: Math.round(ancho) }));
      };
      const soltar = () => {
        arrastre.current = null;
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);
        // Se persiste al SOLTAR y no en cada píxel: un arrastre son cientos de
        // eventos, y escribir en cada uno castiga el hilo por nada.
        setAnchos((previos) => {
          guardar(tabla, previos);
          return previos;
        });
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
      window.addEventListener('pointercancel', soltar);
    },
    [tabla],
  );

  /**
   * Flechas izquierda y derecha, un paso por pulsación.
   *
   * Es lo que convierte el tirador en un control de verdad y no en un adorno
   * para quien usa ratón: sin esto, una tabla con las columnas mal repartidas no
   * hay forma de arreglarla desde el teclado. El paso de 16 px mueve lo bastante
   * para notarse sin obligar a treinta pulsaciones.
   */
  const conTeclado = useCallback(
    (columna: string) => (evento: React.KeyboardEvent<HTMLElement>) => {
      const paso = evento.key === 'ArrowLeft' ? -16 : evento.key === 'ArrowRight' ? 16 : 0;
      if (paso === 0) return;
      const celda = evento.currentTarget.closest('th');
      if (!(celda instanceof HTMLElement)) return;
      evento.preventDefault();
      const actual = anchos[columna] ?? celda.getBoundingClientRect().width;
      const ancho = Math.max(MINIMO_PX, Math.round(actual + paso));
      setAnchos((previos) => {
        const siguiente = { ...previos, [columna]: ancho };
        guardar(tabla, siguiente);
        return siguiente;
      });
    },
    [anchos, tabla],
  );

  const restablecer = useCallback(() => {
    setAnchos({});
    guardar(tabla, {});
  }, [tabla]);

  return {
    anchoDe: (columna) => anchos[columna],
    empezar,
    conTeclado,
    restablecer,
    ajustada: Object.keys(anchos).length > 0,
  };
}
