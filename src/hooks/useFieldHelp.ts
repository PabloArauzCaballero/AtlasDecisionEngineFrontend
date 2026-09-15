'use client';

import { useId, useState } from 'react';

/**
 * El estado que comparten la etiqueta de un campo y su control.
 *
 * Dos cosas que un tooltip suelto no puede dar:
 *
 * 1. `describedById` — el `id` del `<span>` visualmente oculto con el texto de
 *    ayuda. El control lo referencia con `aria-describedby`, así que el lector
 *    de pantalla lo lee al entrar en el campo AUNQUE la burbuja esté cerrada.
 *    Sin esto, la ayuda sólo existe para quien ve el icono y puede apuntar a él.
 * 2. `focused` — la burbuja se abre también al enfocar el CONTROL con el
 *    teclado, no sólo al llegar al icono ⓘ. Quien tabula por un formulario
 *    nunca pasa por el icono.
 */
export function useFieldHelp(tooltip?: string) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return {
    describedById: tooltip ? `${id}-ayuda` : undefined,
    controlId: `${id}-control`,
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
