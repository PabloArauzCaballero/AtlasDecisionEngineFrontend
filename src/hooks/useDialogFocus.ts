'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Elementos que pueden recibir el foco con el tabulador. `[tabindex="-1"]` se
 * excluye a propósito: se enfoca por código, no tabulando.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Descarta lo que está oculto por atributo. A propósito NO usa `offsetParent`,
 * que es el atajo habitual para "¿se ve?": vale `null` en todo elemento
 * `position: fixed`, y un diálogo modal siempre lo es, así que el filtro se
 * habría comido justo los controles que hay que atrapar.
 */
function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Hace que un diálogo se comporte como tal para quien no usa el ratón.
 *
 * Declarar `role="dialog"` y `aria-modal="true"` es una promesa al lector de
 * pantalla: "lo de detrás no existe mientras yo esté abierto". Sin esta lógica
 * la promesa es falsa —el foco sigue en la página de atrás y el primer
 * tabulador se escapa del diálogo—, así que quien navega con teclado acaba
 * rellenando un formulario que no ve.
 *
 * Se encarga de cuatro cosas:
 *  1. llevar el foco dentro al abrir (al primer control, o al propio diálogo);
 *  2. mantenerlo dentro, haciendo que el tabulador dé la vuelta en los bordes;
 *  3. cerrarlo con Escape, si quien lo usa dice cómo cerrarlo;
 *  4. devolver el foco al elemento que abrió el diálogo cuando se cierra, para
 *     no dejar a nadie al principio de la página sin saber dónde estaba.
 *
 * El punto 3 faltaba, y su ausencia era exactamente el agujero que la trampa de
 * foco abre: atrapar el foco sin dar salida por teclado deja encerrado a quien
 * no usa el ratón. `ModalDialog` lo resolvía por su cuenta, así que los diálogos
 * que pasan por él sí cerraban; los que usan este hook directamente —el alta de
 * despliegue, entre otros— no, y se detectó barriendo el portal con teclado.
 * Vive aquí y no en cada diálogo porque la promesa la hace `aria-modal`, que es
 * lo que este hook existe para cumplir.
 *
 * @param container Referencia al elemento con `role="dialog"`.
 * @param initialFocus Control concreto que debe recibir el foco al abrir.
 * @param onClose Cómo cerrar el diálogo. Sin él, Escape no hace nada — que es
 *   lo correcto para un panel que no se puede cerrar, no un valor por omisión.
 */
export function useDialogFocus(
  container: RefObject<HTMLElement | null>,
  initialFocus?: RefObject<HTMLElement | null>,
  onClose?: () => void,
): void {
  // Se captura en el primer render, antes de que el diálogo robe el foco.
  const opener = useRef<HTMLElement | null>(null);

  /*
   * `onClose` se guarda en una referencia y no entra en las dependencias.
   *
   * El efecto corre UNA vez, al montar, a propósito (ver abajo). Si `onClose`
   * fuera dependencia, cada render con una función nueva —lo normal, si se
   * escribe en línea— volvería a montar la trampa y devolvería el foco al
   * principio del diálogo mientras alguien escribe.
   */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const dialog = container.current;
    if (!dialog) return;

    const target = initialFocus?.current ?? focusableWithin(dialog)[0] ?? dialog;
    if (target === dialog && !dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
    target.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) {
        // `stopPropagation` no: dos diálogos anidados deben cerrarse de dentro
        // hacia fuera, y cada uno atiende su propio Escape. `preventDefault` sí,
        // para que el navegador no cancele además el campo que tuviera el foco.
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableWithin(dialog);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      // Al llegar a un extremo se da la vuelta en lugar de salir al documento.
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (active instanceof Node && !dialog.contains(active)) {
        // El foco ya se había escapado (p. ej. venía del navegador): se recupera.
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      /*
       * Se devuelve el foco sólo si nadie se lo llevó a otra parte a propósito.
       * Cuando React desmonta el diálogo, sus nodos ya están sueltos del
       * documento y el foco ha caído al `<body>` — ése es el caso normal de
       * cierre, y por eso cuenta igual que "seguía dentro".
       */
      const active = document.activeElement;
      const releasedOnClose = active === null || active === document.body;
      if ((releasedOnClose || dialog.contains(active)) && opener.current?.isConnected) {
        opener.current.focus();
      }
    };
    // Deliberadamente sólo al montar/desmontar: el diálogo se monta al abrirse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
