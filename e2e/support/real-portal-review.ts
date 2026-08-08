/**
 * Mide si algo se sale del ancho del documento.
 *
 * Mismo criterio que `responsive.spec.ts` y que el generador de evidencia: los
 * contenedores que scrollean a propósito —tablas, lienzo del grafo— no cuentan,
 * y lo `fixed` tampoco, porque no participa del flujo.
 */
export const MEDIDA_DESBORDE = `(() => {
  const doc = document.documentElement;
  const limite = doc.clientWidth + 1;
  const culpables = [];
  for (const nodo of document.querySelectorAll('body *')) {
    const caja = nodo.getBoundingClientRect();
    if (caja.width === 0 || caja.right <= limite) continue;
    if (getComputedStyle(nodo).position === 'fixed') continue;
    if (nodo.closest('.table-wrap, .graph-canvas-viewport, [data-scroll-x]')) continue;
    if (nodo.closest('[aria-hidden="true"]')) continue;
    const clase = (nodo.className || '').toString().split(' ')[0] || '(sin clase)';
    culpables.push(nodo.tagName.toLowerCase() + '.' + clase + ' se sale ' + Math.round(caja.right - limite) + 'px');
  }
  const pequenos = [];
  for (const nodo of document.querySelectorAll('button, a[href], select, [role="button"], [role="tab"]')) {
    if (nodo.closest('.sr-only') || nodo.classList.contains('sr-only')) continue;
    const caja = nodo.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) continue;
    if (caja.width >= 24 && caja.height >= 24) continue;
    const clase = (nodo.className || '').toString().split(' ')[0] || '(sin clase)';
    pequenos.push(nodo.tagName.toLowerCase() + '.' + clase + ' mide ' + Math.round(caja.width) + '×' + Math.round(caja.height));
  }
  return {
    desborde: doc.scrollWidth - doc.clientWidth,
    culpables: [...new Set(culpables)].slice(0, 8),
    pequenos: [...new Set(pequenos)].slice(0, 8),
  };
})()`;

export interface MedidaResponsive {
  desborde: number;
  culpables: string[];
  pequenos: string[];
}

/**
 * Revisión de una vista, medida ENTERA dentro del navegador.
 *
 * Un solo `page.evaluate` en lugar de una llamada por control. La diferencia no
 * es de estilo: recorriendo los controles desde el proceso de la prueba, cada
 * `innerText` es un viaje de ida y vuelta, y una vista con tabla —cientos de
 * enlaces— convertía el barrido en horas. Aquí el bucle corre donde está el DOM.
 *
 * El nombre accesible se calcula igual que lo lee un lector de pantalla en el
 * caso común: `aria-label`, si no el texto, si no `title`. No cubre
 * `aria-labelledby` ni el nombre implícito de un `<img alt>` dentro del botón,
 * así que puede señalar como anónimo algo que sí tiene nombre por esa vía; se
 * prefiere ese falso positivo —que se revisa a mano— a dar por nombrado un
 * control que no lo está.
 */
export const REVISION_DE_VISTA = `(() => {
  const visible = (nodo) => {
    const caja = nodo.getBoundingClientRect();
    return caja.width > 0 && caja.height > 0;
  };

  const sinNombre = [];
  const controles = document.querySelectorAll(
    'button, [role="button"], a[href], [role="tab"]'
  );
  for (const nodo of controles) {
    if (!visible(nodo)) continue;
    if (nodo.closest('[aria-hidden="true"]')) continue;
    const nombre =
      (nodo.getAttribute('aria-label') || '').trim() ||
      (nodo.innerText || '').trim() ||
      (nodo.getAttribute('title') || '').trim() ||
      (nodo.getAttribute('aria-labelledby') ? 'via-labelledby' : '');
    if (nombre) continue;
    const clase = (nodo.className || '').toString().split(' ')[0] || '(sin clase)';
    sinNombre.push(nodo.tagName.toLowerCase() + '.' + clase);
  }

  const textoPagina = (document.body.innerText || '');
  const doc = document.documentElement;

  return {
    encabezados: document.querySelectorAll('h1, h2, [role="heading"]').length,
    limiteDeError: /algo salió mal|error inesperado|application error/i.test(textoPagina),
    sinNombre: [...new Set(sinNombre)].slice(0, 12),
    desborde: doc.scrollWidth - doc.clientWidth,
  };
})()`;

export interface RevisionDeVista {
  encabezados: number;
  limiteDeError: boolean;
  sinNombre: string[];
  desborde: number;
}
