# Sistema responsivo

Cómo se adapta este portal y dónde se decide cada cosa. Si vas a escribir una
vista nueva, esto es lo único que necesitas leer.

## La regla corta

**Antes de escribir un `@media`, comprueba si el problema se resuelve solo.**
La mayoría de las veces sí: una rejilla `auto-fit` o un `flex-wrap` colocan el
contenido según el sitio que hay, sin que nadie tenga que decidir a qué ancho.
Una consulta de medios es una decisión que alguien tomó una vez y que nadie
vuelve a revisar; una rejilla que se adapta sola no caduca.

## 1. Puntos de corte

Cuatro. Están en [`src/styles/breakpoints.ts`](../src/styles/breakpoints.ts) con
la explicación de por qué existe cada uno.

| Token | px   | Qué se reorganiza ahí                                                                                                                                           |
| ----- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sm`  | 560  | La cabecera de página deja de tener sitio para sus acciones al lado del título; las barras de filtro pasan a una columna; los diálogos van a pantalla completa. |
| `md`  | 820  | La barra lateral de 280 px ya no cabe y se vuelve cajón. Es el corte que más mueve.                                                                             |
| `lg`  | 1180 | Dejan de caber tres columnas en el editor; la barra superior pierde sus enlaces duplicados.                                                                     |
| `xl`  | 1600 | Tope de `.content`: por encima el contenido se centra en vez de estirarse.                                                                                      |

**No inventes un quinto.** `src/styles/breakpoints.test.ts` recorre todas las
hojas de `parts/` y falla si aparece un ancho fuera de esta lista. Antes había
nueve (560, 640, 680, 720, 820, 900, 980, 1050, 1180), varios separados por 40 px
—una diferencia que no distingue ningún dispositivo ni ninguna reorganización,
sólo distingue quién escribió la hoja—.

CSS no admite `var()` dentro de `@media`, así que el número se escribe a mano.
Esa prueba es lo único que impide que vuelva a derivar.

## 2. Tokens

En [`parts/responsive-tokens.css`](../src/styles/parts/responsive-tokens.css).

| Token          | Valor                       | Para qué                                                                   |
| -------------- | --------------------------- | -------------------------------------------------------------------------- |
| `--gutter`     | `clamp(16px, 3.2vw, 32px)`  | Margen lateral de `.content` y `.topbar`. Continuo, sin salto en el corte. |
| `--stack-gap`  | `clamp(12px, 2vw, 24px)`    | Separación vertical entre bloques.                                         |
| `--tap-min`    | `24px`                      | Área táctil mínima (WCAG 2.2 AA, 2.5.8).                                   |
| `--viewport-h` | `100dvh` (respaldo `100vh`) | Alto de ventana que sí descuenta la barra del navegador móvil.             |

Los de espacio, radio y tipografía siguen en `parts/foundation.css`; los de color
en `parts/theme.css`. **Ningún color se escribe a mano fuera de ahí.**

### Por qué `--viewport-h` y no `100vh`

`100vh` en un teléfono mide la ventana **con la barra de direcciones retraída**,
un tamaño que casi nunca está en pantalla. Un diálogo dimensionado con `100vh`
deja su pie —donde están «Aceptar» y «Cancelar»— por debajo del borde visible.
`dvh` mide lo que de verdad se ve. Se declara en dos pasos (`100vh` y luego
`@supports (height: 100dvh)`) para que un navegador que no lo conozca se quede
con la primera declaración en vez de sin altura ninguna.

### Área segura (muesca y esquinas redondeadas)

`layout.next.tsx` declara `viewportFit: 'cover'` y las hojas devuelven el margen
con `max(var(--gutter), env(safe-area-inset-left, 0px))` en `.content`,
`.topbar` y el cajón, más `env(safe-area-inset-bottom)` en el pie de los
diálogos a pantalla completa.

**Los dos son un solo cambio.** `viewport-fit: cover` extiende la página bajo la
muesca; sin los `env()` eso mete contenido debajo del recorte, que es peor que no
haber hecho nada. Si tocas uno, revisa el otro.

El `, 0px` de respaldo no es decorativo: sin él, un navegador que no conozca
`env()` descarta la declaración entera y la vista se queda sin márgenes.

### Zoom

**Nunca pongas `maximum-scale` ni `user-scalable=no`.** Bloquear el zoom incumple
WCAG 1.4.4 y no se nota mirando la pantalla —sólo al intentar el gesto—, así que
entra en el proyecto sin que nadie lo vea. `layout.next.tsx` declara
`userScalable: true` sin tope, y `responsive.spec.ts` vigila la etiqueta emitida.

Para medir el 200 % se usa la equivalencia: ampliar al 200 % en 1280×1024 deja
exactamente 640×512 píxeles CSS. Playwright no expone el zoom real del
navegador, y esa equivalencia es lo que permite comprobarlo igual que cualquier
otro ancho.

## 3. Patrones por tipo de componente

### Rejillas

Preferido, porque decide por contenido y no por dispositivo:

```css
grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
```

El `min(100%, 220px)` es lo que evita el desbordamiento clásico de `auto-fit`:
sin él, con un contenedor de 200 px la pista pide 220 y se sale.

Sólo usa un número fijo de columnas (`repeat(3, ...)`) cuando las columnas
signifiquen algo entre sí —una comparación lado a lado— y añádele su consulta.

### Filas de controles

`flex-wrap: wrap` desde el principio, no a partir de un corte, y `min-width: 0`
en el hijo que lleva el texto largo. Sin ese `min-width`, un ítem flex se niega
a encogerse por debajo de su contenido y es él quien fuerza el desbordamiento.

### Tablas

La estrategia móvil de este portal **ya existe y es la fila desplegable** de
`DataTable`: cada fila abre un `<dl>` con TODAS las columnas, incluidas las que
la fila recorta y las marcadas `detail`. Por eso las celdas pueden recortarse
con puntos suspensivos sin que se pierda el dato.

Sobre eso:

- `.table-wrap` desplaza en horizontal y **anuncia que lo hace**: un degradado
  pintado con `background-attachment: local/scroll` que sólo aparece cuando
  queda contenido por ese lado. Sin JavaScript y sin nodos extra.
- `overscroll-behavior-x: contain` evita que al terminar la tabla el gesto
  arrastre la página.
- `min-width: 0` en `.table-wrap` y `.panel`: es lo que permite que la tabla
  desplace dentro de su caja en vez de estirar el layout entero.

Si creas una tabla con `tools={false}` no hay desplegable: entonces la tabla
debe caber, o las columnas que sobren deben ir marcadas `detail`.

**Envuelve siempre en `.table-wrap`.** Hay 16 `<table>` escritas a mano en las
vistas y varias no lo hacían: con seis columnas y `white-space: nowrap` en las
cabeceras imponían su ancho intrínseco y se salían —644 px fuera en
`/calculated-fields` a 320—, y como el marco recorta no se veía barra de
desplazamiento, se veía media tabla. `parts/responsive-tokens.css` pone un suelo
(`table:not(.table-wrap table)` desplaza por sí misma), pero es una red, no el
patrón: sin el envoltorio pierdes la cabecera anclada y los indicios de que hay
más a la derecha.

### Columnas de composición

Todo hijo directo de una rejilla de composición necesita `min-width: 0`. Por
omisión vale `auto`, que significa «me niego a bajar del ancho de mi contenido»:
un panel con una tabla dentro impone su ancho y arrastra la vista entera. Ya está
aplicado a las once composiciones principales en `parts/responsive-tokens.css`;
si añades una, añádela ahí.

### Diálogos

Por debajo de 560 px van a pantalla completa (`.modal-dialog` y
`.objective-create-dialog`), con la rejilla `auto | 1fr | auto` que mantiene el
pie visible sin calcular alturas a mano, y las acciones apiladas —un botón en la
esquina inferior derecha es el punto peor alcanzable a una mano—.

`ModalDialog` se monta en `document.body` vía portal. No es preferencia: un
ancestro con `transform` (y `.route-view` deja uno fijado por
`animation-fill-mode: both`) convierte `position: fixed` en relativo a ESE
ancestro, y el velo pasaba a medir la página entera.

### Interacciones que dependían de `hover`

Envuélvelas en `@media (hover: none)` para que en un dispositivo táctil estén
visibles sin gesto previo. Ejemplo real: `.dash-card-action` estaba en
`opacity: 0` y sólo aparecía al pasar el cursor o al enfocar por teclado —dos
cosas que en un teléfono no ocurren—.

## 4. Áreas táctiles

Mínimo `--tap-min` (24×24), el nivel AA. Se gana con `min-height`/`width` y
`padding`, **nunca agrandando la letra**: el rótulo de un encabezado de tabla
mide 10 px porque tiene que caber en su fila, y subirlo rompería la tabla. Lo que
crece es la zona que acepta el toque, no lo que se lee.

`e2e/responsive.spec.ts` lo verifica sobre el DOM pintado. Se exceptúa el patrón
`sr-only`: un control de 1×1 oculto a la vista pero disponible para lectores de
pantalla es intencionado.

## 5. Ocultar: cuándo se puede

Se puede ocultar algo en pantallas estrechas **sólo si su función sigue
alcanzable por otro camino**, y el otro camino tiene que existir de verdad.

| Se oculta           | A partir de | Alternativa                                                                                                    |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `.top-links`        | 1180        | Sus tres destinos están en el cajón de navegación.                                                             |
| `.security-label`   | 1180        | Indicador de estado, sin acción asociada.                                                                      |
| `.user-summary`     | 820         | El pie del cajón muestra el mismo usuario.                                                                     |
| `.global-search`    | 820         | **«Búsqueda Global» en el cajón** — antes no existía y la vista `/search` quedaba inalcanzable en un teléfono. |
| `.environment-chip` | 560         | Duplicado del ambiente que ya indica el cajón.                                                                 |
| `.canvas-legend`    | 560         | Cada nodo explica su tipo al seleccionarlo (`node-catalog.ts`).                                                |

`.filters-panel` y `.wizard-steps` **ya no se ocultan**. Estaban en
`display: none` y no eran adorno: el carril de filtros contiene la única
búsqueda de la vista de casos de prueba, y el índice de pasos es lo que dice en
qué paso del asistente estás. Ahora fluyen como banda horizontal por encima del
contenido.

## 6. Qué comprueba cada prueba

| Prueba                           | Qué afirma                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/breakpoints.test.ts` | Ninguna hoja usa un ancho fuera de la escala.                                                                             |
| `e2e/responsive.spec.ts`         | Ningún elemento se sale del viewport en las rutas de guardia × {320, 768, 1280}; ningún control por debajo de 24×24.      |
| `e2e/overflow-detector.spec.ts`  | Documenta que `.app-shell` recorta, y avisa si esa red de seguridad desaparece.                                           |
| `e2e/responsive-audit.spec.ts`   | Herramienta, no prueba: barre 41 rutas × 10 anchos y deja el resultado en `docs/visual-evidence/`. `yarn test:e2e:tools`. |
| `e2e/contrast.spec.ts`           | Contraste AA sobre el DOM pintado, 24 rutas × 2 temas.                                                                    |

**Aviso sobre el desbordamiento:** no lo midas con
`documentElement.scrollWidth`. `.app-shell` lleva `overflow-x: clip` y eso hace
que el documento nunca crezca — una prueba escrita así pasa siempre, incluso con
la vista rota. Mide el **borde derecho de cada elemento** contra
`clientWidth`, exceptuando `position: fixed` y lo que viva dentro de
`.table-wrap` o del lienzo del grafo, donde salirse es el diseño.

## 7. Al añadir una vista

1. Registra la ruta en `src/auth/route-access.ts` (sin regla, la vista desaparece).
2. Añádela a `e2e/support/responsive-matrix.ts` — a `AUDIT_ROUTES` siempre, y a
   `GATE_ROUTES` si estrena una organización estructural que no tenga hermana.
3. Usa `auto-fit` y `flex-wrap` antes que un `@media`.
4. Si necesitas un `@media`, usa uno de los cuatro anchos.
5. Corre `yarn verify` y `yarn test:e2e:prod`.
