# Matriz de prueba responsive

Qué se mide, dónde, con qué datos y qué se hace a mano porque no se puede
automatizar de forma honesta.

## 1. Anchos

Declarados en [`e2e/support/responsive-matrix.ts`](../e2e/support/responsive-matrix.ts),
que es la lista canónica: la comparten el generador de evidencia y la prueba que
bloquea la entrega. Antes había dos listas distintas y la que bloqueaba cubría un
subconjunto que nadie había auditado.

| Categoría          |   px | En la corrida que bloquea | En el barrido completo |
| ------------------ | ---: | :-----------------------: | :--------------------: |
| Móvil muy pequeño  |  320 |             ●             |           ●            |
| Móvil pequeño      |  360 |                           |           ●            |
| Móvil estándar     |  390 |            ●¹             |           ●            |
| Móvil grande       |  430 |                           |           ●            |
| Tableta vertical   |  768 |             ●             |           ●            |
| Tableta horizontal | 1024 |                           |           ●            |
| Portátil           | 1280 |             ●             |           ●            |
| Escritorio         | 1440 |                           |           ●            |
| Escritorio grande  | 1920 |                           |           ●            |
| Ultraancho         | 2560 |                           |           ●            |

¹ 390 se usa sólo para la comprobación de áreas táctiles: es el ancho de teléfono
más común y donde el dedo es el único puntero.

**Por qué la corrida que bloquea usa tres anchos y no diez.** La suite corre con
un worker contra un servidor —medido: en paralelo, 8 fallos en 25,8 min; en
serie, 26 pruebas en verde en 6,3 min—. Los tres cortes cubren las tres
organizaciones distintas del marco (cajón, tableta, escritorio), que es donde
cambia algo. La matriz de diez vive en las herramientas, que se piden a mano.

## 2. Rutas

41 vistas con pantalla propia. La lista completa está en `AUDIT_ROUTES`.

`GATE_ROUTES` es el subconjunto que bloquea: una vista de cada familia
estructural —tabla densa, detalle en dos columnas, editor, asistente, panel,
formulario— más las que han roto antes.

```
/login  /variables  /calculated-fields  /actions  /graph-editor  /test-cases
/test-suites  /executions/1  /simulator  /manual-reviews/1  /audit-events
/platform-health
```

`/` no está: es una redirección de servidor a `/login`, no una vista. Medirla
además aborta la navegación siguiente y tumba el barrido entero.

**Corregido en esta auditoría:** la lista anterior incluía `/action-catalog`,
que no existe —la ruta registrada es `/actions`—, así que una de las seis rutas
cubiertas medía una pantalla de «no encontrado» en cinco anchos.

## 3. Datos

**Siempre con `e2e/support/dense-backend.ts`.** El motor simulado normal
devuelve listados VACÍOS: una prueba escrita contra él mide cabeceras y estados
vacíos creyendo que mide la vista entera, y una vista vacía nunca se sale de la
pantalla. El denso reparte todos los estados con color propio entre las filas y
mete textos largos a propósito para provocar truncados y saltos de línea.

`/graph-editor` es la excepción: usa `mockBackend` porque necesita un grafo con
forma, no filas.

## 4. Qué afirma cada prueba

| Prueba                             | Afirma                                                                                                             | Corre en             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `src/styles/breakpoints.test.ts`   | Ninguna hoja de `parts/` usa un ancho fuera de la escala de cuatro.                                                | `yarn test`          |
| `e2e/responsive.spec.ts`           | Ningún elemento se sale del viewport (12 rutas × 3 anchos). Ningún control mide menos de 24×24 (3 rutas × 390 px). | `yarn test:e2e:prod` |
| `e2e/overflow-detector.spec.ts`    | Documenta que `.app-shell` recorta; falla si esa red de seguridad desaparece.                                      | `yarn test:e2e:prod` |
| `e2e/contrast.spec.ts`             | Contraste AA sobre el DOM pintado, 24 rutas × 2 temas.                                                             | `yarn test:e2e:prod` |
| `src/theme/theme-contrast.test.ts` | Cada token de texto sobre cada superficie cumple 4,5:1.                                                            | `yarn test`          |

### Herramientas (no afirman nada)

| Herramienta                     | Produce                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/responsive-audit.spec.ts`  | `docs/visual-evidence/responsive-audit.json` — 41 rutas × 10 anchos, con el borde derecho de cada elemento que sobresalga y cada control por debajo de 24×24. |
| `e2e/visual-evidence.spec.ts`   | Capturas por ruta y tema.                                                                                                                                     |
| `e2e/style-fingerprint.spec.ts` | Huella de estilos calculados, para comparar antes/después al refactorizar CSS.                                                                                |

Se piden con `yarn test:e2e:tools`.

## 5. Cómo medir el desbordamiento (importante)

**No uses `documentElement.scrollWidth`.** `.app-shell` lleva `overflow-x: clip`
y un contenedor recortado no propaga hacia arriba el ancho de su contenido: la
medida clásica es constante por construcción y la prueba pasa siempre.

Comprobado, no supuesto — `e2e/overflow-detector.spec.ts` inyecta en `.content`
un bloque del doble de ancho que la ventana:

| Magnitud                    | Antes de inyectar |                     Después |
| --------------------------- | ----------------: | --------------------------: |
| Borde derecho del intruso   |                 — | **720 px** (ventana de 360) |
| `scrollWidth − clientWidth` |                 0 |                       **0** |

La medida buena es el **borde derecho de cada elemento** contra `clientWidth`,
con tres excepciones, y cada una defendible:

- `position: fixed` — velos y cajones se posicionan fuera del flujo a propósito.
- Descendientes de `.table-wrap`, `.graph-canvas-viewport` o `[data-scroll-x]` —
  ahí salirse ES el diseño, para eso desplazan.
- Descendientes de `[aria-hidden="true"]` — el fondo ambiental son manchas de luz
  de 1070 px que se salen 214 px por diseño, y el recorte del marco es lo que les
  da forma. La aplicación ya declara que no son contenido.

**No amplíes esta lista sin poder escribir el porqué.** La exclusión por
`aria-hidden` está acotada a lo que el propio código marca como decoración; si se
ensancha a «lo que parezca decorativo», la prueba vuelve a ser ciega, que es
exactamente el defecto del que parte toda esta auditoría.

## 6. Comprobaciones manuales

No están automatizadas porque automatizarlas mal daría una falsa tranquilidad.

| Qué                          | Cómo                                           | Criterio                                                                              |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Teclado virtual              | Teléfono real, abrir un diálogo con formulario | El pie con las acciones sigue alcanzable (lo cubre `--viewport-h`).                   |
| Orientación horizontal       | Teléfono a 844×390                             | El cajón cabe y el contenido no queda bajo la barra superior.                         |
| Fuente aumentada del sistema | Android «Tamaño de fuente: máximo»             | Las filas crecen; no se solapan.                                                      |
| Área segura (notch)          | iPhone con muesca, en horizontal               | El cajón y la barra no quedan bajo el recorte. **Implementado, sin ver en hardware.** |
| Cajón abierto                | 360 px, abrir menú                             | El foco entra en el cajón; `Esc` lo cierra; el fondo no desplaza.                     |

El zoom al 200 % **ya no está aquí**: lo cubre `responsive.spec.ts` midiendo a
640×512, que son los píxeles CSS que deja ampliar al 200 % sobre 1280×1024. Se
comprueba además que la etiqueta `viewport` no lo bloquee.

## 7. Cómo reproducir

```bash
# Gate completo (formato, lint, límites de fuente, tipos, unidad, build)
yarn verify

# La corrida canónica: contra el artefacto que se despliega
yarn build
yarn test:e2e:prod

# Sólo lo responsive
npx playwright test --config playwright.prod.config.ts responsive.spec.ts

# Barrido completo de 41 × 10 (minutos; deja JSON en docs/visual-evidence/)
yarn test:e2e:tools --grep "auditoría responsive"
```

**No corras `yarn build` con el servidor de desarrollo levantado**: la build
reescribe `.next` y el servidor en marcha se queda con módulos que ya no
existen.
