/**
 * Escala de puntos de corte — única fuente de verdad de la reorganización.
 *
 * Antes había NUEVE valores distintos (560, 640, 680, 720, 820, 900, 980, 1050,
 * 1180) repartidos entre `parts/responsive.css`, `parts/auth-feedback.css` y una
 * docena de hojas de característica. Varios se diferenciaban en 40 px, que no
 * distingue ningún dispositivo ni ninguna reorganización: distinguía quién
 * escribió la hoja. Añadir una vista obligaba a adivinar cuál tocaba.
 *
 * Los cuatro que quedan no son «modelos de teléfono», son los anchos donde ESTE
 * portal reorganiza de verdad:
 *
 *  - `sm` (560): la cabecera de página deja de tener sitio para su fila de
 *    acciones al lado del título, y las barras de filtro pasan a una columna.
 *  - `md` (820): la barra lateral de 280 px ya no cabe junto al contenido y se
 *    convierte en cajón. Es el corte que más cosas mueve.
 *  - `lg` (1180): dejan de caber tres columnas (biblioteca · lienzo ·
 *    propiedades) en el editor, y la barra superior pierde sus enlaces.
 *  - `xl` (1600): tope de `.content`; por encima el contenido se centra en vez
 *    de estirarse y perder la línea de lectura.
 *
 * CSS no admite `var()` dentro de `@media`, así que los números se escriben a
 * mano en las hojas. Para que eso no vuelva a derivar, `breakpoints.test.ts`
 * recorre TODAS las hojas de `parts/` y falla si aparece un `max-width` o
 * `min-width` que no esté en esta lista.
 */
export const breakpoints = {
  sm: 560,
  md: 820,
  lg: 1180,
  xl: 1600,
} as const;

export type BreakpointName = keyof typeof breakpoints;

/** Los mismos valores como consulta lista para `matchMedia`. */
export const upTo = (name: BreakpointName): string => `(max-width: ${breakpoints[name]}px)`;

/**
 * Anchos mínimos de área táctil.
 *
 * 24 px es el mínimo de WCAG 2.2 nivel AA (criterio 2.5.8, «Target Size
 * Minimum»); 44 px es el de nivel AAA. Se adopta AA porque subir toda la
 * interfaz a 44 px reorganizaría cabeceras de tabla y barras de forma bien
 * visible, y el objetivo declarado es AA.
 *
 * Espejo de `--tap-min` en `parts/responsive-tokens.css`.
 */
export const tapMinimumPx = 24;
