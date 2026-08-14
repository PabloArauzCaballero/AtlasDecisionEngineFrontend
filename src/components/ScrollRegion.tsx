'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ScrollRegionProps {
  children: ReactNode;
  className?: string;
  /** Qué contiene, para anunciarlo cuando la región recibe el foco. */
  label: string;
}

/**
 * Caja que se desplaza y que además se puede desplazar CON EL TECLADO.
 *
 * Una tabla ancha vive dentro de `.table-wrap`, que recorta y desplaza en
 * horizontal. Con ratón se arrastra; con teclado no había forma de llegar a las
 * columnas de la derecha, porque el contenedor no era enfocable y las celdas de
 * una tabla de sólo lectura tampoco lo son. Las columnas existían, se veía el
 * degradado que avisa de que siguen, y eran inalcanzables — WCAG 2.1.1.
 *
 * El `tabIndex` se pone SÓLO cuando de verdad hay desbordamiento, y por eso hay
 * medición en vez de un `tabIndex={0}` fijo. Una parada de tabulación por cada
 * tabla del portal, incluidas las que caben de sobra, convierte recorrer la
 * página en pulsar Tab contra cajas que no hacen nada: el remedio se leería como
 * otra avería. Se remide al cambiar el tamaño porque una tabla que cabe a 1440
 * puede no caber a 900, y quien reduce la ventana no recarga.
 */
export function ScrollRegion({ children, className = '', label }: ScrollRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // +1: `scrollWidth` y `clientWidth` difieren en un píxel por redondeo
    // subpíxel en tablas que sí caben, y sin holgura todas parecerían desbordar.
    const measure = () => setOverflows(node.scrollWidth > node.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // También el contenido: cargar una página de resultados cambia el ancho sin
    // que la caja cambie de tamaño.
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div
      ref={ref}
      className={`table-wrap ${className}`.trim()}
      /*
       * `role="region"` sólo cuando es enfocable. Declararlo siempre llenaría la
       * navegación por regiones de entradas que no llevan a ninguna parte.
       */
      {...(overflows ? { tabIndex: 0, role: 'region', 'aria-label': label } : {})}
    >
      {children}
    </div>
  );
}
