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
