# Informe de implementación responsive

Fecha: 2026-08-04 · Base: `0a7bb23` · Plan:
[`RESPONSIVE_AUDIT_AND_IMPLEMENTATION_PLAN.md`](RESPONSIVE_AUDIT_AND_IMPLEMENTATION_PLAN.md)

## 1. Resumen

El punto de partida no era una interfaz rota: era **una prueba incapaz de
detectar si lo estaba**. `.app-shell` recorta a lo ancho y la única prueba
responsive medía justo la magnitud que el recorte mantiene constante, así que
pasaba por construcción.

En cuanto hubo un detector capaz de fallar, apareció lo que llevaba tiempo
escondido: **nueve vistas se salían de la pantalla sin dejar rastro**, entre
ellas el editor de grafo en un portátil de 1280 px. Y junto a eso, defectos que
ninguna prueba miraba: controles imposibles de pulsar con el dedo, funciones que
desaparecían en móvil sin sustituto, y una hoja de estilos que no se cargaba.

El resultado no es sólo «se arregló el responsive»: es que ahora **hay con qué
medirlo**, y con esa medida el barrido completo —41 rutas × 10 anchos, 410
cargas— cierra en **cero**.

## 2. El hallazgo principal

`.app-shell` lleva `overflow-x: clip`. Un contenedor recortado no propaga hacia
arriba el ancho de su contenido, así que `documentElement.scrollWidth` —lo que
medía `e2e/responsive.spec.ts`— es constante por construcción.

No es una deducción. `e2e/overflow-detector.spec.ts` inyecta en `.content` un
bloque del doble de ancho que la ventana:

| Magnitud                         | Antes |                     Después |
| -------------------------------- | ----: | --------------------------: |
| Borde derecho del bloque intruso |     — | **720 px** (ventana de 360) |
| `scrollWidth − clientWidth`      |     0 |                       **0** |

El bloque se sale sin discusión y la medida no se mueve. Esa prueba pasaba con
la vista rota, y seguiría pasando.

Además cubría **6 rutas de 41**, y una de ellas —`/action-catalog`— **no
existe**: la ruta registrada es `/actions`. Una de cada seis mediciones era
sobre una pantalla de «no encontrado».

### Qué se midió después, y por qué no hay que fiarse del primer barrido

El primer barrido con el detector nuevo salió en cero, y **eso era engañoso**:
poco después el gate encontró 29 fallos en las mismas rutas y anchos. La
diferencia estaba en la herramienta, no en el portal —el barrido excluía de más y
volcaba su informe sólo al terminar, de modo que una corrida caída dejaba en
disco el JSON anterior haciéndose pasar por fresco—. Ambas cosas están
corregidas (§8), y la lección se quedó en el código: la herramienta y el gate
comparten hoy las mismas exclusiones, porque dos criterios distintos son dos
verdades distintas.

La cifra que vale es la de la corrida limpia y completa, ya con todo corregido:
**410/410 cargas, 0 elementos fuera del viewport, 0 controles por debajo de
24×24**.

## 3. Problemas resueltos

### Instrumento

| #   | Problema                                    | Corrección                                                                                                                                          |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | La prueba de desbordamiento no podía fallar | Mide el borde derecho de cada elemento contra `clientWidth`, con tres exclusiones justificadas (`fixed`, contenedores que desplazan, `aria-hidden`) |
| C2  | `/action-catalog` no existe                 | Lista canónica única en `e2e/support/responsive-matrix.ts`, compartida por auditoría y gate                                                         |
| C1b | Nada avisaba si el recorte desaparecía      | `e2e/overflow-detector.spec.ts` documenta y vigila la red de seguridad                                                                              |

### Defectos de producto

| #   | Problema                                     | Medido                                                                           | Corrección                                                                                                                      |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Ayuda del selector de tema cortada en móvil  | Globo de **414 px** de ancho, borde derecho en **388** con ventana de 320        | `.tooltip-bubble` con tope `min(260px, calc(100vw - 2*--gutter))` y `white-space: normal`; `.topbar` añadido al anclaje derecho |
| P2  | Encabezado ordenable impulsable con el dedo  | **47×14 px** en toda tabla                                                       | `min-height: var(--tap-min)`                                                                                                    |
| P3  | Enlace «Simulate» de la barra                | **65×15 px**                                                                     | idem                                                                                                                            |
| P4  | Disparador de ayuda de columna               | **18×18 px**, 95 apariciones                                                     | `width/height: var(--tap-min)` en `info-hint.css`                                                                               |
| P5  | Enlace del feed del panel                    | **60×15 px**                                                                     | `min-height` + `inline-flex`                                                                                                    |
| P6  | Botón de limpiar búsqueda de tabla           | **22×22 px**                                                                     | `var(--tap-min)`                                                                                                                |
| P7  | Conmutador del catálogo de acciones          | **139×16 px**                                                                    | `min-height: var(--tap-min)`                                                                                                    |
| P8  | `/search` inalcanzable en móvil              | `.global-search` oculto ≤820 y la ruta no estaba en ninguna otra navegación      | Entrada «Búsqueda Global» en el cajón                                                                                           |
| P9  | Filtros de casos de prueba desaparecían      | `display: none` ≤820; contenían la única búsqueda de la vista                    | Banda horizontal compacta sobre el contenido                                                                                    |
| P10 | Índice de pasos del asistente desaparecía    | `display: none` ≤820                                                             | Fila desplazable; se sigue viendo en qué paso se está                                                                           |
| P11 | Acción de tarjeta del panel sólo con `hover` | `opacity: 0` salvo `hover`/`focus-visible`                                       | `@media (hover: none)` la deja visible                                                                                          |
| P12 | `code-import.css` nunca se cargaba           | `.import-target` usado en `ImportTargetPicker.tsx`, hoja ausente de `global.css` | Añadida al `@import`                                                                                                            |
| P13 | Regla del cajón duplicada                    | Misma regla en `foundation.css` y `sidebar-drawer.css`                           | Sólo en `sidebar-drawer.css`                                                                                                    |
| P14 | Diálogo genérico sin tratamiento móvil       | Sólo `.objective-create-dialog` lo tenía                                         | `.modal-dialog` a pantalla completa <560, acciones apiladas                                                                     |
| P15 | Tabla sin indicio de que continúa            | Desplazamiento horizontal mudo                                                   | Degradado `background-attachment: local/scroll`                                                                                 |

### Defectos que sólo aparecieron al poder medirlos

Todo lo de esta tabla lo encontró el detector nuevo, y **nada de ello era
visible con la medida anterior**: el marco recorta, así que se veía media vista
y ninguna barra de desplazamiento que insinuara que había más.

| #   | Problema                                                   | Medido                                                                | Corrección                                                                                               |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P16 | **El editor de grafo no cabía en un portátil de 1280**     | Panel de propiedades **89 px fuera**; pista de 1090 px en 1000 reales | Carriles laterales con `clamp()` y central `minmax(0,1fr)`; `.graph-canvas` pierde su `min-width: 500px` |
| P17 | Tablas escritas a mano sin envoltorio desplazable          | `/calculated-fields`: **644 px fuera** a 320, **205** a 768           | `table:not(.table-wrap table)` desplaza por sí misma                                                     |
| P18 | Columnas de composición que no encogen (`min-width: auto`) | `/executions/1` **186 px**, `/manual-reviews/1` **217 px**            | `min-width: 0` a los hijos de las 11 composiciones principales                                           |
| P19 | Buscador del carril de filtros con ancho de `size=20`      | `/test-cases`: carril **351 px fuera** a 320                          | `width: auto` acotado a casillas y radios; el texto pasa a `100%`                                        |
| P20 | Globo de ayuda centrado sobre disparador pegado al borde   | `/actions`: **91 px fuera** a 320                                     | Anclaje derecho en `th`, `.panel-title` y cabeceras de contrato, más tope de ancho                       |
| P21 | Fila de pasos de autoría con `flex: 0 0 auto`              | `/graph-editor`: **150 px fuera** a 320                               | `flex: 0 1 auto` + `flex-wrap`                                                                           |
| P22 | Sangrado del editor con número fijo (`-32px`)              | Borde **1 px fuera** por lado al hacerse fluido `--gutter`            | `margin: calc(-1 * var(--stack-gap)) calc(-1 * var(--gutter))`                                           |
| P23 | Enlace «Saltar al contenido» inline: el relleno no contaba | **181×17 px**, el primer control que recibe el foco                   | `inline-flex` + `min-height: var(--tap-min)`                                                             |
| P24 | Nota de ayuda del contrato de salida sin encoger           | `/graph-editor`: **43 px fuera**                                      | `min-width: 0` + `overflow-wrap` en `.field-hint` y `.output-chips`                                      |

### Sistema

| #   | Problema                                                                  | Corrección                                                                                      |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| S1  | Nueve puntos de corte (560/640/680/720/820/900/980/1050/1180) en 14 hojas | Cuatro (`sm` 560, `md` 820, `lg` 1180, `xl` 1600), **con prueba que impide inventar un quinto** |
| S2  | `100vh` en marco, diálogos y editor (15 apariciones)                      | `--viewport-h` = `100dvh` con respaldo `100vh`                                                  |
| S3  | Margen lateral en dos escalones (32→18)                                   | `--gutter: clamp(16px, 3.2vw, 32px)`, continuo                                                  |
| S4  | Rejillas de columnas fijas que no colapsan                                | `repeat(auto-fit, minmax(min(100%, Npx), 1fr))` en 6 rejillas                                   |
| S5  | `.page-header` sólo envolvía bajo 560                                     | `flex-wrap: wrap` desde el principio + `min-width: 0`                                           |

## 4. Componentes creados

| Fichero                                  | Qué es                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/styles/breakpoints.ts`              | Escala de cuatro cortes, documentada, más `--tap-min` en TS                                                |
| `src/styles/breakpoints.test.ts`         | Recorre `parts/*.css` y falla si aparece un ancho fuera de la escala                                       |
| `src/styles/parts/responsive-tokens.css` | `--gutter`, `--stack-gap`, `--tap-min`, `--viewport-h`, `.content` fluido, suelo táctil, medios adaptables |
| `e2e/support/responsive-matrix.ts`       | Rutas y anchos canónicos, compartidos por auditoría y gate                                                 |
| `e2e/overflow-detector.spec.ts`          | Prueba experimental de la ceguera del recorte                                                              |
| `e2e/responsive-audit.spec.ts`           | Herramienta: barrido 41 × 10 a `docs/visual-evidence/responsive-audit.json`                                |

## 5. Componentes modificados

`e2e/responsive.spec.ts` (reescrita), `playwright.config.ts`, `global.css`,
`navigation.ts`, y 20 hojas de `parts/`: `foundation`, `auth-feedback`,
`controls`, `data-display`, `dashboard`, `info-hint`, `action-icons`,
`table-tools`, `objective-authoring`, `responsive`, `operations-governance`,
`node-io`, `graph-actions`, `accessibility-feedback`, `graph-shell`,
`login-premium`, `search-picking`, `ambient-variants`, `execution-playback`,
`visual-language`, `tutorial-center`.

**Ningún cambio en lógica de negocio, peticiones, validaciones, rutas,
permisos, estado ni formularios.** El único cambio fuera de CSS y pruebas es una
entrada de navegación (`/search`), que usa la política de acceso que ya existía.

## 6. Resultados de verificación

**`yarn verify` completo en verde** (256 s), con el árbol ya quieto:

| Comprobación                      | Resultado                                                 |
| --------------------------------- | --------------------------------------------------------- |
| `yarn format:check`               | ✅ sin diferencias                                        |
| `yarn lint` (`--max-warnings=0`)  | ✅ sin avisos                                             |
| `yarn verify:source`              | ✅ toda ruta con regla de acceso, todo token resuelve     |
| `yarn typecheck`                  | ✅ sin errores                                            |
| `yarn test` (Vitest)              | ✅ **728 pruebas, 93 ficheros**                           |
| `src/styles/breakpoints.test.ts`  | ✅ 4/4                                                    |
| `yarn build`                      | ✅ artefacto de producción generado                       |
| `responsive.spec.ts` (47 pruebas) | ✅ **47/47**                                              |
| `overflow-detector.spec.ts`       | ✅ la ceguera del recorte queda documentada y vigilada    |
| `responsive-shots.spec.ts`        | ✅ 24 capturas en `docs/visual-evidence/responsive/`      |
| `responsive-audit.spec.ts` (tool) | ✅ **410/410 cargas · 0 recortes · 0 controles pequeños** |

Las 47 pruebas responsive cubren 13 rutas × 3 anchos (se sale a lo ancho),
3 rutas de áreas táctiles a 390 px, 3 rutas al equivalente de zoom del 200 %
(640×512) y la etiqueta `viewport`.

**El barrido completo de la matriz cerró en limpio**: 41 rutas × 10 anchos, 410
cargas, **ni un elemento fuera del viewport y ni un control por debajo de
24×24**. Es la fotografía que respalda todo lo anterior. Detalle en §8.

La prueba nueva de puntos de corte **ha encontrado tres desviaciones reales
mientras se escribía este informe**, todas de la sesión que trabaja en paralelo:
`tutorial-center.css` con 900 px, `graph-shell.css` con 720 y `test-cases.css`
con 900. Las tres alineadas a 820. Es exactamente el trabajo para el que existe.

## 7. Riesgos y limitaciones

1. **Área segura (notch): implementada, no comprobada en hardware.**
   `layout.next.tsx` declara `viewportFit: 'cover'` y `parts/responsive-tokens.css`
   devuelve el margen con `max(--gutter, env(safe-area-inset-*, 0px))` en
   `.content`, `.topbar` y el cajón, más `env(safe-area-inset-bottom)` en el pie
   de los diálogos a pantalla completa. Los dos cambios van juntos por
   necesidad: `viewport-fit: cover` **sin** los `env()` metería contenido bajo la
   muesca, que es peor que el punto de partida. En un dispositivo sin muesca todo
   `env()` vale 0 y no cambia nada —eso sí está verificado, por el barrido—, pero
   **el comportamiento con muesca real sigue sin verse en un teléfono**. Es la
   limitación que más conviene cerrar a mano.
2. **Teclado virtual sin automatizar.** Está en la matriz como
   comprobación manual. `--viewport-h` ataca la causa del problema del teclado,
   pero no se ha visto en un teléfono real.
3. **El editor de grafo sigue siendo una herramienta de escritorio.** Por debajo
   de 820 px sus tres columnas se apilan y el lienzo conserva 620 px de alto
   mínimo. Es usable, no cómodo. Rediseñarlo excede una auditoría responsive.
4. **`.canvas-legend` sigue oculta bajo 560 px.** La información equivalente
   está en cada nodo al seleccionarlo (`node-catalog.ts`), pero es un clic más.
5. **Los cambios de punto de corte mueven anchos intermedios.** Migrar 900→820
   (login), 980→1180 (panel), 1050→1180 (métricas), 680→560 y 640→560 cambia
   dónde se reorganizan esas vistas. Es el precio de tener una escala; el
   barrido no encontró ningún problema derivado.
6. **La comparación visual es «después», no «antes/después».**
   `e2e/responsive-shots.spec.ts` deja 24 capturas (6 familias de vista × 4
   anchos, uno de ellos el equivalente a zoom del 200 %) en
   `docs/visual-evidence/responsive/`. Sirven de línea base para el siguiente
   cambio, pero **no hay lado «antes»**: para tenerlo habría que haber tomado las
   capturas en `0a7bb23` antes de empezar, y no se hizo. Reconstruirlo ahora
   exigiría un `git stash` del trabajo entero, que en un árbol compartido con
   otra sesión no es una operación segura.
7. **El zoom al 200 % se mide por equivalencia, no con zoom real.** Playwright
   no expone el zoom del navegador; ampliar al 200 % en 1280×1024 deja
   exactamente 640×512 píxeles CSS, y eso es lo que se prueba. Cubre el criterio
   de WCAG 1.4.4 (no perder contenido ni funcionalidad), no el renderizado
   exacto del motor al ampliar.

## 8. Estado de la verificación final

**Aviso importante sobre estos resultados.** Durante este trabajo hubo **otra
sesión editando el mismo repositorio**: apareció un Centro de Tutoriales
completo (`/tutorials`, `TutorialCenterPage.tsx`, `tutorial-registry.ts`,
`tutorial-center.css` y ocho ficheros más) y se modificaron ficheros que esta
auditoría no tocó (`ThemeToggle`, `NotificationCenter`, `PlatformStatusPage`,
`GlobalSearchBox`, `access-policies`, `route-access`).

Se detectaron además **dos `next build` simultáneos sobre el mismo `.next`**, que
corrompieron cuatro compilaciones seguidas —`build-manifest.json` ausente a media
escritura, `types/routes.d.ts` no encontrado, `_buildManifest.js.tmp` borrado en
vuelo, y el aviso «Wait for the build to complete» del bloqueo de Next—.

**Hubo un tramo con el gate en rojo, y no era de aquí.** Durante horas
`yarn build` abortaba por un error de tipos en un fichero que la otra sesión
estaba refactorizando:

```
src/pages/TestCasesPage.tsx(251,21): error TS2322:
  Property 'tagsJson' is optional in type '…' but required in type '…'
```

Sin `next build` no hay artefacto, y sin artefacto no hay `test:e2e:prod`. En ese
tramo la verificación se hizo contra el servidor de desarrollo, que no somete el
código a `tsc`: 44/44 en verde. Se dejó dicho entonces que **eso no era la
corrida canónica**, porque no lo era.

**Ya está resuelto.** La otra sesión corrigió su error de tipos y sus siete
pruebas de `TutorialCenterPage.test.tsx`; aquí se arreglaron los dos restos que
dejaban el gate en rojo para todos:

- `src/api/http-client.ts` estaba commiteado sin formatear.
- `docs/visual-evidence/responsive-audit.json` lo genera `JSON.stringify` en cada
  barrido, así que su formato no es decisión de nadie: bajo el control de
  formato obligaba a reformatearlo tras cada corrida. Va a `.prettierignore`.

Con el árbol quieto, `yarn verify` pasa entero y la corrida canónica sí se
ejecutó. Los números están en §6.

**El barrido completo sí se completó, al quinto intento.** Los cuatro anteriores
cayeron por el entorno y no por el código: dos compilaciones ajenas simultáneas,
un servidor de desarrollo apagado desde fuera a media corrida, y una suspensión
de la máquina que dejó 393 de 410 cargas en `ERR_NETWORK_IO_SUSPENDED`.

Resultado de la corrida buena (22,5 min, `2026-08-04T20:35:48Z`):

| Magnitud                      |       Valor |
| ----------------------------- | ----------: |
| Cargas completadas            | **410/410** |
| Errores de carga              |       **0** |
| Elementos que se salen        |       **0** |
| Controles por debajo de 24×24 |       **0** |

Merece la pena señalar que **el cuarto intento fue el que demostró que la
corrección de la herramienta funciona**: en vez de dejar en disco el JSON de una
corrida anterior haciéndose pasar por fresco —que es lo que hacía antes—, escribió
su marca de tiempo y las 393 cargas fallidas, una por una. Una herramienta que
declara que no pudo medir vale infinitamente más que una que calla; sin ese
cambio, este informe habría citado como vigentes unos hallazgos de tres horas
antes, ya corregidos.

Una consecuencia que conviene no perder de vista: los resultados de `lint`,
`typecheck`, `test` y del gate end-to-end **cubren el árbol combinado**, no sólo
los cambios de esta auditoría. Están en verde, pero si mañana uno se pone en
rojo, mirar el fichero concreto antes de atribuirlo.

Y un aviso sobre la historia: el commit `158734d` («diálogos centrados y la X del
cajón fuera de escritorio», 65 ficheros, 5865 inserciones) **incluye trabajo de
esta auditoría** que su mensaje no menciona —`responsive-tokens.css`,
`breakpoints.ts`, `breakpoints.test.ts`, `overflow-detector.spec.ts` y
`responsive-matrix.ts`—. Si se va a construir historia sobre él, conviene
saberlo.

Para repetir la verificación completa:

```bash
yarn verify                 # formato, lint, fuentes, tipos, unidad, build
yarn test:e2e:prod          # la corrida canónica, contra el artefacto
yarn test:e2e:tools         # barrido 41×10 y capturas (minutos, no bloquea)
```

## 9. Mantenimiento

- **Antes de escribir un `@media`, prueba con `auto-fit` o `flex-wrap`.** Una
  rejilla que se adapta al contenido no caduca; una consulta de medios es una
  decisión que alguien tomó una vez y nadie revisa.
- **No midas el desbordamiento con `scrollWidth`** en este portal. Está
  explicado en `RESPONSIVE_DESIGN_SYSTEM.md` §6.
- **Al añadir una vista**, regístrala en `route-access.ts` y añádela a
  `AUDIT_ROUTES`; a `GATE_ROUTES` sólo si estrena organización estructural.
- **No amplíes las exclusiones del detector** sin una razón que puedas escribir.
  La exclusión por `aria-hidden` está acotada a lo que el propio código declara
  decoración; ensancharla volvería a dejar la prueba ciega, que es exactamente
  el defecto del que parte este informe.
