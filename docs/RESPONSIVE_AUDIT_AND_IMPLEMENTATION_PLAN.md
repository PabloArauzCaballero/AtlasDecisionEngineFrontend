# Auditoría responsive y plan de implementación

Fecha: 2026-08-04 · Rama: `main` · Base: `0a7bb23`

## 1. Resumen ejecutivo

El portal **no tiene un defecto responsive aislado, tiene un instrumento de
medida roto**. Ese es el hallazgo que cambia el resto del trabajo.

`.app-shell` lleva `overflow-x: clip` como red de seguridad. La consecuencia no
prevista es que **nada de lo que hay dentro puede ensanchar el documento**: un
panel demasiado ancho ya no produce barra de desplazamiento, produce contenido
_cortado_. Y `e2e/responsive.spec.ts` —la única prueba responsive del
repositorio— mide exactamente `documentElement.scrollWidth` contra
`clientWidth`, es decir, mide justo lo que el recorte hace imposible.

No es una sospecha, está comprobado. `e2e/overflow-detector.spec.ts` inyecta en
`.content` un bloque del **doble de ancho que la ventana** y mide las dos cosas:

- borde derecho del intruso: **720 px** con ventana de 360 → se sale, es un hecho;
- `scrollWidth − clientWidth`: **0 antes y 0 después** → el documento no se entera.

La prueba de desbordamiento no está pasando porque el portal esté bien: está
pasando porque, con ese CSS, **no puede fallar**.

Ahora la otra mitad del resultado, que conviene decir con la misma claridad:
**medido el estado real —41 rutas × 10 anchos, 410 cargas contra el artefacto de
producción— no hay un solo elemento que sobresalga del viewport**, ni por
desbordamiento ni por recorte (la medición nueva mira el borde derecho de cada
elemento, que el recorte no falsea). El trabajo previo sobre `min-width: 0` en
`.table-wrap` y `.panel` sostiene bien. Lo que falta no es reparar el ancho: es
que exista un instrumento capaz de avisar cuando se rompa.

A eso se suma que esa misma prueba cubre **6 rutas de 41**, y una de ellas
(`/action-catalog`) **no existe** —la ruta real es `/actions`—, así que una sexta
parte de la cobertura declarada mide una pantalla de «no encontrado».

Por debajo de eso hay tres problemas estructurales reales:

1. **Elementos que desaparecen sin alternativa.** Bajo 820 px el portal oculta
   `.global-search`, `.filters-panel` y `.wizard-steps`; bajo 1180 px oculta
   `.top-links`. Filtrar y buscar dejan de existir en móvil, no se degradan.
2. **Áreas táctiles por debajo del mínimo.** Medido en las 41 rutas: el enlace
   «Simulate» de la barra superior mide **65×15 px**, los encabezados ordenables
   de todas las tablas **47×14 px**, y los botones de ayuda **18×18 px**. WCAG
   2.2 AA (2.5.8) exige 24×24. Ordenar una tabla es hoy imposible con el dedo.
3. **Breakpoints inventados por hoja.** Nueve puntos de corte distintos (560,
   640, 680, 720, 820, 900, 980, 1050, 1180) repartidos entre `responsive.css`,
   `auth-feedback.css` y una docena de hojas de característica. Nadie puede
   añadir una vista sin adivinar cuál le toca.

Y un defecto de carga que sólo se ve leyendo la lista de importaciones:
`src/styles/parts/code-import.css` **no estaba importado en `global.css`**. Las
clases `.import-target` y `.import-target-modes` se usan en
`ImportTargetPicker.tsx` pero su hoja nunca se cargaba, así que el selector de
destino de la importación se pintaba sin panel, sin separaciones y sin el
`flex-wrap` que baja de línea sus tres modos cuando no caben.

## 2. Stack detectado

Detectado leyendo el repositorio, no supuesto.

| Aspecto         | Valor                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.2.1, App Router                                                                                                                               |
| React           | 19.2.7 (React Compiler no habilitado)                                                                                                                    |
| Lenguaje        | TypeScript 5.8, `strict`                                                                                                                                 |
| Rutas           | App Router con `pageExtensions: ['next.tsx','next.ts']` — las páginas se llaman `page.next.tsx`. Un `page.tsx` **no se carga**.                          |
| Estilos         | CSS plano, un único `global.css` con 74 `@import` de `src/styles/parts/*.css`. **Sin Tailwind, sin CSS-in-JS, sin CSS Modules.**                         |
| Tokens          | `parts/theme.css` (color, por tema) + `parts/foundation.css` (espacio, radio, tipografía)                                                                |
| Iconos          | `lucide-react` 0.468 + catálogos propios (`concept-icons.ts`, `action-catalog.ts`)                                                                       |
| Estado servidor | TanStack Query 5.83 (`QueryProvider.tsx`, errores de mutación vía `MutationCache`)                                                                       |
| Estado UI       | `useState` local + contextos propios (tutorial, ambiente, cambios sin guardar)                                                                           |
| Formularios     | Nativos controlados. Sin react-hook-form ni Formik.                                                                                                      |
| Validación      | Zod 3.25 (contratos de API)                                                                                                                              |
| Tablas          | Componente propio `src/components/DataTable.tsx`. Sin TanStack Table.                                                                                    |
| Gráficos        | Ninguno de librería: SVG propio (`graph-editor`, `version-graph`, `ambient`)                                                                             |
| Editor código   | `@monaco-editor/react` 4.7                                                                                                                               |
| Pruebas unidad  | Vitest 3.2 + Testing Library + jsdom                                                                                                                     |
| Pruebas E2E     | Playwright 1.61, un worker, Chromium                                                                                                                     |
| Lint/formato    | ESLint 9 (flat, `--max-warnings=0`) + Prettier 3.6                                                                                                       |
| Gates propios   | `scripts/verify-source.mjs` (299 líneas/fichero, sin `fetch` directo) + `verify-conventions.mjs` (tokens definidos, sin color a mano, rutas registradas) |
| Build           | `next build`, `output: 'standalone'`                                                                                                                     |

**Restricciones que condicionan todo el plan:**

- Máximo **299 líneas por fichero** de código, **incluido CSS**. No se puede
  resolver esto metiendo 400 líneas en `responsive.css`.
- **Ningún color escrito a mano** fuera de `theme.css`.
- **Todo `var(--token)` debe existir**; si no, el navegador descarta la
  declaración entera y el estilo desaparece sin avisar.
- Toda ruta de `(portal)` necesita su patrón en `src/auth/route-access.ts`.

## 3. Inventario de rutas

41 vistas con pantalla propia (`e2e/support/responsive-matrix.ts` es ahora la
lista canónica, compartida por la auditoría y por la prueba que bloquea).

| Familia         | Rutas                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticación   | `/login` (`/` redirige aquí)                                                                                                                                                 |
| Panel           | `/platform-health`                                                                                                                                                           |
| Búsqueda        | `/search`                                                                                                                                                                    |
| Catálogos       | `/variables`, `/variables/[id]`, `/calculated-fields`, `/calculated-fields/[id]`, `/reason-codes`, `/actions`, `/libraries`                                                  |
| Artefactos      | `/artifacts`, `/artifacts/[id]`, `/artifacts/[id]/dependency-graph`, `/algorithms`                                                                                           |
| Autoría         | `/graph-editor`, `/artifact-versions/[id]/graph`, `/code-import`                                                                                                             |
| Compilación     | `/artifact-versions/[id]/compile`                                                                                                                                            |
| Calidad         | `/test-suites`, `/test-suites/[id]/cases`, `/test-cases`, `/artifact-versions/[id]/test-suites`, `/test-runs/[id]`, `/test-runs/[id]/coverage`, `/graph-coverage`, `/qa-lab` |
| Trazabilidad    | `/objectives`, `/objectives/[id]`, `/coverage-matrix`                                                                                                                        |
| Gobierno        | `/reviews`, `/approval-requests/[id]`, `/security-review/[id]`                                                                                                               |
| Operación       | `/environments`, `/deployments`, `/simulator`, `/live-execution`                                                                                                             |
| Revisión manual | `/manual-reviews`, `/manual-reviews/[id]`                                                                                                                                    |
| Auditoría       | `/executions`, `/executions/[id]`, `/audit-events`                                                                                                                           |

## 4. Inventario de componentes críticos

| Componente       | Fichero                        | Por qué es crítico                                                      |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Marco            | `layout/next/NextAppShell.tsx` | Envuelve todo; monta barra, tema, ambiente, avisos                      |
| Barra superior   | `layout/next/NextTopbar.tsx`   | 10 elementos en fila sin envolver                                       |
| Barra lateral    | `layout/next/NextSidebar.tsx`  | Fija 280 px; cajón bajo 820 px                                          |
| Tabla            | `components/DataTable.tsx`     | Base de ~20 vistas. **Ya trae fila desplegable** con todas las columnas |
| Modal            | `components/ModalDialog.tsx`   | Único diálogo genérico del portal                                       |
| Cabecera         | `components/PageHeader.tsx`    | Título + acciones en todas las vistas                                   |
| Filtros          | `.filter-bar` (`controls.css`) | Se oculta entero bajo 820 px                                            |
| Pestañas         | `components/Tabs.tsx`          | Ya envuelve (`flex-wrap`)                                               |
| Editor de grafo  | `features/graph-editor/*`      | Tres columnas, lienzo con `min-width: 500px`                            |
| Ayuda contextual | `components/InfoHint.tsx`      | Disparador de 18×18 px en cabeceras de tabla                            |

## 5. Problemas encontrados, severidad y estrategia

### CRÍTICO

**C1 · La prueba de desbordamiento no puede fallar**
_Causa:_ `.app-shell { overflow-x: clip }` impide que el documento crezca; la
prueba mide `scrollWidth`. _Impacto:_ hoy el portal no desborda, así que el
daño no es una vista rota sino **una red de seguridad que no lo es**: cualquier
regresión futura entraría en verde. Comprobado inyectando un bloque del doble
de ancho (`e2e/overflow-detector.spec.ts`): el intruso llega a 720 px con
ventana de 360 y `scrollWidth − clientWidth` se queda en 0. _Solución:_ medir el
borde derecho de cada elemento contra el viewport, excluyendo `position: fixed`
y los contenedores que sí desplazan a propósito (`.table-wrap`). _Ficheros:_
`e2e/responsive.spec.ts`, `e2e/responsive-audit.spec.ts`. _Riesgo:_ ninguno en
producción; sólo pruebas.

**C2 · Cobertura de prueba sobre una ruta inexistente**
_Causa:_ `/action-catalog` en la lista; la ruta registrada es `/actions`.
_Impacto:_ 1 de 6 rutas medía una pantalla de «no encontrado» en 5 anchos.
_Solución:_ lista única en `e2e/support/responsive-matrix.ts`, derivada del
inventario real. _Riesgo:_ ninguno.

**C3 · Áreas táctiles por debajo de WCAG 2.2 AA (2.5.8)**
Medido en las 41 rutas:

| Control                        | Medido     | Mínimo | Dónde                            |
| ------------------------------ | ---------- | ------ | -------------------------------- |
| `a.top-action` («Simulate»)    | 65×**15**  | 24×24  | barra superior, todas las vistas |
| `button.table-sort`            | 47×**14**  | 24×24  | cabecera de toda tabla ordenable |
| `button.info-hint-trigger`     | **18×18**  | 24×24  | ayuda de columna, 95 apariciones |
| `a.dash-card-action`           | 250×**15** | 24×24  | panel de inicio                  |
| `button.action-catalog-toggle` | 139×**16** | 24×24  | editor de grafo                  |
| `button` de limpiar búsqueda   | **22×22**  | 24×24  | barra de tabla                   |

_Impacto:_ **ordenar una tabla es hoy impracticable con el dedo**, y es la
acción más repetida del portal. _Solución:_ token `--tap-min` y altura mínima en
los seis selectores, sin cambiar el tamaño visible del texto (se gana con
`padding` y `min-height`, no agrandando la letra). _Riesgo:_ alturas de fila y
de barra crecen unos píxeles; hay que revisar la cabecera de tabla anclada.

### ALTO

**A1 · Elementos ocultos sin alternativa**
`.global-search` y `.filters-panel` y `.wizard-steps` (≤820 px), `.top-links`
(≤1180 px), `.canvas-legend` (≤560 px), `.environment-chip` (≤560 px),
`.user-summary` (≤820 px). _Impacto:_ en móvil no se puede filtrar un listado ni
buscar; el asistente pierde su índice de pasos. _Solución:_ para cada uno,
alternativa antes que ocultación — la búsqueda entra en el cajón de navegación,
los filtros pasan a panel desplegable, los pasos del asistente a resumen
«Paso N de M». Los puramente decorativos o duplicados (`security-label`,
`user-summary`, `environment-chip`) sí pueden ocultarse: su información está en
el cajón. _Riesgo:_ medio — toca la barra superior, que está en todas las vistas.

**A2 · Nueve breakpoints sin sistema**
560/640/680/720/820/900/980/1050/1180, repartidos en 14 hojas. _Solución:_
escala de cuatro (`--bp-sm 560`, `--bp-md 820`, `--bp-lg 1180`, `--bp-xl 1600`)
documentada en `RESPONSIVE_DESIGN_SYSTEM.md`; las hojas de característica migran
a los cortes vecinos. _Riesgo:_ alto si se hace de golpe — se hace por hoja, con
huella de estilo antes/después (`yarn test:e2e:tools --grep huella`).

**A3 · `100vh` en marco, diálogos y editor**
9 apariciones. En móvil `100vh` incluye la barra del navegador: el pie del
diálogo queda bajo ella y las acciones no se alcanzan. _Solución:_ `100dvh` con
respaldo `100vh` previo. _Riesgo:_ bajo.

**A4 · Rejillas de columnas fijas que no colapsan**
`repeat(2|3|4, minmax(0,1fr))` en 10 hojas sin media query propia
(`operations-governance`, `node-io`, `graph-actions`, `data-display`,
`objective-authoring`…). _Solución:_ `repeat(auto-fit, minmax(min(100%, Npx),
1fr))` — colapsa por contenido, no por nombre de dispositivo, y elimina la
media query. _Riesgo:_ bajo; cambia el número de columnas en anchos intermedios.

**A5 · Barra superior sin envolver**
10 hijos, `flex` sin `flex-wrap`, `padding: 0 32px`. Bajo el recorte del marco
los últimos se cortan en silencio. _Solución:_ padding fluido y prioridad
explícita de qué se retira primero. _Riesgo:_ medio.

### MEDIO

- **M1** · `.modal-dialog` no tiene tratamiento móvil (sí lo tiene
  `.objective-create-dialog`): a pantalla completa bajo 560 px.
- **M2** · `.page-header` es `flex` sin envolver hasta 560 px, donde salta a
  `display: block`. Envolver desde el principio.
- **M3** · `.content` y `.topbar` con padding en dos escalones (32→18 px). Padding
  fluido con `clamp()`.
- **M4** · Tablas: `td { white-space: nowrap; max-width: 320px }` + scroll
  horizontal, **sin indicio visible de que hay más a la derecha**. La fila
  desplegable ya resuelve el acceso al dato; falta el indicio y falta cubrir
  `tools={false}`, donde no hay desplegable.
- **M5** · `.graph-canvas { min-width: 500px }`: bajo 820 px se neutraliza, entre
  820 y 1180 px estruja los paneles vecinos.
- **M6** · `code-import.css` sin importar (**ya corregido**).
- **M7** · Regla del cajón duplicada en `foundation.css` y `sidebar-drawer.css`
  (**ya corregida**: queda sólo en `sidebar-drawer.css`).

### BAJO

- **B1** · `TutorialOverlay.tsx` posiciona con `window.innerWidth - 340`, número
  mágico atado al ancho de la tarjeta.
- **B2** · `.login-page`, `.loading-screen`, `.not-found` con `min-height: 100vh`.
- **B3** · Sin `padding` de área segura (notch) en cajón ni diálogos.
- **B4** · `input.sr-only` de 1×1 aparece en la medición; es el patrón de
  ocultación accesible y está exento, pero conviene marcarlo para que no se
  confunda con un defecto en futuras corridas.

## 6. Orden de implementación

1. **Instrumento** (C1, C2) — sin medida fiable, lo demás es opinión.
2. **Fundamentos** (A2, A3, M3) — tokens de breakpoint, `dvh`, contenedores.
3. **Navegación** (A1, A5) — barra superior y cajón.
4. **Compartidos** (C3, M1, M2, M4) — táctil, modal, cabecera, tablas.
5. **Rejillas y pantallas** (A4, M5) — lo que señale la medición.
6. **Accesibilidad** (B3, zoom 200 %).
7. **Verificación** — `yarn verify` + `test:e2e:prod` + evidencia.
8. **Documentación** — los cuatro entregables.

## 7. Criterios de aceptación

- Ningún elemento sobresale del viewport en 41 rutas × {320, 768, 1280} px, con
  la medición nueva (borde derecho, no `scrollWidth`).
- Ningún control interactivo mide menos de 24×24 px, salvo el patrón `sr-only`.
- Buscar y filtrar siguen alcanzables a 320 px.
- El diálogo genérico entra completo con sus acciones a 320×568.
- `yarn verify` en verde y `yarn test:e2e:prod` en verde.
- Sin regresión de contraste (`theme-contrast.test.ts`, `e2e/contrast.spec.ts`).

## 8. Riesgos de regresión

| Riesgo                                               | Mitigación                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Tocar la barra superior afecta a las 41 vistas       | Huella de estilo antes/después; barrido completo                       |
| Subir alturas táctiles descuadra la cabecera anclada | Revisión explícita de `th` anclado en el barrido                       |
| Migrar breakpoints mueve puntos de corte intermedios | Una hoja por vez, con medición entre pasos                             |
| El límite de 299 líneas obliga a partir hojas        | Hoja nueva `parts/responsive-tokens.css`, no engordar `responsive.css` |
| `overflow-x: clip` sigue tapando defectos nuevos     | La prueba ya no depende de él                                          |

## 9. Decisiones que se conservan

- **`overflow-x: clip` se queda.** Es una red de seguridad legítima contra
  adornos superpuestos, y `hidden` rompería las cabeceras `sticky`. Lo que
  cambia es la medición, no la regla.
- **CSS plano.** No se introduce Tailwind, CSS Modules ni CSS-in-JS.
- **La fila desplegable de `DataTable`** es la estrategia móvil de tablas: ya
  existe, ya funciona y no se sustituye por tarjetas.
- **Identidad visual**: ni un color, ni una fuente, ni un radio cambian.
- **Sin dependencias nuevas.**

## 10. Suposiciones

1. Que `.global-search`, `.filters-panel` y `.wizard-steps` se ocultaron por
   falta de sitio y no por decisión de producto. Se conserva la funcionalidad y
   se le da alternativa; no se elimina nada.
2. Que `--tap-min: 24px` (mínimo AA) es el objetivo, no los 44 px de AAA:
   subir a 44 px reorganizaría cabeceras y barras de forma visible, y el
   requisito citado es «equivalente a WCAG 2.2 AA».
3. Que el `input.sr-only` de 1×1 es ocultación accesible intencionada.
4. Que los identificadores `1` usados en las rutas con parámetro sirven para
   medir: el motor simulado responde a cualquiera.
