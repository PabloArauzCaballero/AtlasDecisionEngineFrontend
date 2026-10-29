# Plan — correcciones de hallazgos del QA (Motor FE)

- Fecha: 2026-10-29 · Repos afectados: AtlasDecisionEngineFrontend · Predecesor: AtlasDocumentationHub/10-testing/qa-flujo-completo-2026-10-28
- Resultado observable: el panel «Última versión de cada algoritmo» lista los algoritmos que sí tienen versiones, y Escape cierra el recorrido guiado.
- Kill-test: `ultimaVersionPorAlgoritmo(filasDeLista([...]))` devuelve filas con un array desnudo.

## Alcance
- IN: `src/features/deployments/UltimaVersionTabla.tsx`, `ultima-version.ts` (OBS-7); recorrido guiado (OBS-10).
- OUT: el resto del portal.
- Ambigüedades: ninguna.

## H1 — OBS-7: el panel no lee `.items` de un array desnudo
**CA:** Dado el endpoint `pickers/artifact-versions` que devuelve un array desnudo con versiones, cuando se abre `/deployments`, entonces el panel lista sus algoritmos.
**DoD:** `yarn vitest run src/features/deployments` + `yarn typecheck` + lint.
**Estado:** A MEDIAS

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `filasDeLista` tolera array desnudo o `{items}` y el panel la usa | devuelve las filas en ambas formas | `yarn vitest run src/features/deployments/ultima-version.test.ts` | HECHO |

## H2 — OBS-10: Escape sale del tutorial no interactivo
**CA:** Dado el tutorial abierto, cuando se pulsa Escape, entonces se cierra sin marcarse completado.
**DoD:** `yarn vitest run src/features/tutorial`.
**Estado:** A MEDIAS

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Listener de Escape en `TutorialOverlay` + prueba | el diálogo desaparece y no hay `atlas.tutorial.completed` | `yarn vitest run src/features/tutorial` → 99 pruebas | HECHO |

## H3 — BUG-7: crear una acción que emite un motivo manda `reasonCodeId: "undefined"`
**CA:** Dado el banco de acciones, cuando se crea una acción «Emitir un motivo» con un código que existe en el catálogo, entonces se guarda en la versión en borrador (PUT del grafo 200); si el código no existe, se explica con un mensaje claro y no se envía nada.
**DoD:** `yarn vitest run src/features/actions` + `yarn lint` + repetir el clic en el navegador.
**Estado:** A MEDIAS

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | `resolverMotivos` (pura): completa `id` y `priority` de cada motivo a partir de su código y falla con mensaje si no existe | resuelve, conserva los que ya traen id, lanza si falta | `yarn vitest run src/features/actions` → 30 pruebas | HECHO |
| H3.S1.M2 | `useActionWrite` la usa antes de armar el cuerpo | el PUT lleva `reasonCodeId` numérico y `priority` ≥ 1 | clic real: ya no responde 400 por motivo; responde 400 `nodes must contain at least 1 elements` (borrador vacío) | A MEDIAS |

## H4 — BUG-8: a 1440×900 el grupo de acciones del editor de grafos tapa el botón «Cargar»
**CA:** Dado el editor de diagrama a 1440×900, cuando se abre, entonces «Cargar» recibe el clic (nada lo cubre) y el lienzo sigue empezando antes de 350 px.
**DoD:** medición `elementFromPoint` en 1280/1440/1920 (script `h4-de-toolbar.cjs`) + `yarn lint` + `e2e/editor-and-tables.spec.ts` si se puede ejecutar.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | `.editor-toolbar` envuelve siempre y `.editor-toolbar-primary` no se encoge | `elementFromPoint(Cargar) === Cargar` en 1280, 1440 y 1920 | medición en Chromium | HECHO |
