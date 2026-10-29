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

| ID       | Microtarea                                                        | CA (binario)                       | DoD                                                               | Estado |
| -------- | ----------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- | ------ |
| H1.S1.M1 | `filasDeLista` tolera array desnudo o `{items}` y el panel la usa | devuelve las filas en ambas formas | `yarn vitest run src/features/deployments/ultima-version.test.ts` | HECHO  |

## H2 — OBS-10: Escape sale del tutorial no interactivo

**CA:** Dado el tutorial abierto, cuando se pulsa Escape, entonces se cierra sin marcarse completado.
**DoD:** `yarn vitest run src/features/tutorial`.
**Estado:** A MEDIAS

| ID       | Microtarea                                       | CA (binario)                                              | DoD                                                  | Estado |
| -------- | ------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------- | ------ |
| H2.S1.M1 | Listener de Escape en `TutorialOverlay` + prueba | el diálogo desaparece y no hay `atlas.tutorial.completed` | `yarn vitest run src/features/tutorial` → 99 pruebas | HECHO  |

## H3 — BUG-7: crear una acción que emite un motivo manda `reasonCodeId: "undefined"`

**CA:** Dado el banco de acciones, cuando se crea una acción «Emitir un motivo» con un código que existe en el catálogo, entonces se guarda en la versión en borrador (PUT del grafo 200); si el código no existe, se explica con un mensaje claro y no se envía nada.
**DoD:** `yarn vitest run src/features/actions` + `yarn lint` + repetir el clic en el navegador.
**Estado:** HECHO

| ID       | Microtarea                                                                                                                 | CA (binario)                                           | DoD                                                                                                                                          | Estado |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| H3.S1.M1 | `resolverMotivos` (pura): completa `id` y `priority` de cada motivo a partir de su código y falla con mensaje si no existe | resuelve, conserva los que ya traen id, lanza si falta | `yarn vitest run src/features/actions` → 30 pruebas                                                                                          | HECHO  |
| H3.S1.M2 | `useActionWrite` la usa antes de armar el cuerpo                                                                           | el PUT lleva `reasonCodeId` numérico y `priority` ≥ 1  | clic real tras guardar un grafo con 4 nodos: `PUT … 200`; BD: acción `EMIT_REASON` + fila en `decision_action_reason_mapping` (motivo id 22) | HECHO  |

## H4 — BUG-8: a 1440×900 el grupo de acciones del editor de grafos tapa el botón «Cargar»

**CA:** Dado el editor de diagrama a 1440×900, cuando se abre, entonces «Cargar» recibe el clic (nada lo cubre) y el lienzo sigue empezando antes de 350 px.
**DoD:** medición `elementFromPoint` en 1280/1440/1920 (script `h4-de-toolbar.cjs`) + `yarn lint` + `e2e/editor-and-tables.spec.ts` si se puede ejecutar.
**Estado:** HECHO

| ID       | Microtarea                                                                  | CA (binario)                                               | DoD                  | Estado |
| -------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------- | ------ |
| H4.S1.M1 | `.editor-toolbar` envuelve siempre y `.editor-toolbar-primary` no se encoge | `elementFromPoint(Cargar) === Cargar` en 1280, 1440 y 1920 | medición en Chromium | HECHO  |

## H5 — BUG-9: una variable con código en mayúsculas rompe la versión de un campo calculado

**CA:** Dado el asistente de campos calculados, cuando se elige una variable del catálogo cuyo código está en mayúsculas, entonces la entrada recibe un id válido (`^[a-z][a-z0-9_]{1,119}$`) y el campo y su versión se crean (`POST 201` ×2).
**DoD:** `yarn vitest run src/features/calculated-fields` + `yarn lint` + clic real con una variable en mayúsculas.
**Estado:** HECHO

| ID       | Microtarea                                                                              | CA (binario)                                               | DoD                                                               | Estado |
| -------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| H5.S1.M1 | `inputIdFromVariableCode` (pura) y su uso en el selector (id y filtro de «ya elegidas») | `QA_H4_279386` → `qa_h4_279386`; códigos raros → id válido | `yarn vitest run src/features/calculated-fields/input-id.test.ts` | TODO   |
| H5.S1.M2 | Clic real con una variable en mayúsculas                                                | `POST /v1/calculated-fields/N/versions` → 201              | script `h4-de-campo.cjs` con `VARIABLE=QA_H4`                     | TODO   |

## H6 — OBS-28 (Motor): selectores que ofrecen versiones que el servidor rechaza

**CA:** (a) En «Nuevo despliegue» sólo se ofrecen versiones desplegables (aprobadas o ya desplegadas); (b) en «Crear acción» sólo se ofrecen versiones editables (borrador o con validación fallida) y, si no hay ninguna, la pantalla lo explica.
**DoD:** `yarn vitest run src/features/deployments src/features/actions` + lint + typecheck (sin errores en `src/`) + clic real.
**Estado:** HECHO

| ID       | Microtarea                                                                            | CA (binario)                                         | DoD                 | Estado |
| -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------- | ------ |
| H6.S1.M1 | `esVersionDesplegable` y su uso en `DeploymentCreateForm`                             | DRAFT y COMPILED no salen                            | prueba              | HECHO  |
| H6.S1.M2 | `esVersionEditable` y su uso en `ActionTargetPanel` (sin aviso falso de «desplegada») | sólo DRAFT/VALIDATION_FAILED                         | prueba              | HECHO  |
| H6.S1.M3 | Clic real de ambas pantallas                                                          | los selectores no ofrecen lo que el servidor rechaza | script (scratchpad) | HECHO  |

## H7 — OBS-17: el editor de grafos deja validar y guardar lo que el servidor rechaza

**CA:** Dado el editor, cuando la versión elegida no está cargada o no es un borrador, entonces «Validar» y «Guardar» están apagados y dicen por qué (antes: `409 VERSION_IMMUTABLE` o `400 INVALID_IF_MATCH` en crudo).
**DoD:** `yarn vitest run src/features/deployments/version-status.test.ts` + lint + typecheck + clic real.
**Estado:** HECHO

| ID       | Microtarea                                                                      | CA (binario)                                               | DoD                | Estado |
| -------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------ | ------ |
| H7.S1.M1 | `motivoSinEdicion(versionId, cargada)` (pura)                                   | null sólo si la versión elegida está cargada y es editable | prueba             | HECHO  |
| H7.S1.M2 | El hook guarda la versión cargada; la barra apaga Validar/Guardar con el motivo | botones apagados con `title`                               | prueba + clic real | HECHO  |

## H8 — OBS-3: «Documentos del solicitante: no se pudieron traer (VALIDATION_ERROR)» en un caso KYB

**CA:** Dado un caso de comercio cuyo identificador de verificación no es el de un intento de identidad, cuando se abre su detalle, entonces el panel no muestra un error: sigue con el expediente del comercio.
**DoD:** `yarn vitest run src/features/manual-review` + lint + typecheck.
**Estado:** HECHO

| ID       | Microtarea                                                                                 | CA (binario)        | DoD          | Estado |
| -------- | ------------------------------------------------------------------------------------------ | ------------------- | ------------ | ------ |
| H8.S1.M1 | Un 400 de validación del identificador se trata como «no es un intento» (igual que el 404) | no propaga el error | prueba nueva | HECHO  |
