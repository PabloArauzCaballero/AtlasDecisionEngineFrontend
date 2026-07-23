# Remediación integral Atlas Decision Engine — Julio 2026

Trabajo coordinado frontend + backend. Documento de entregables (#14) y método (#15).
Fuente de negocio: `AtlasDecisionEngine/docs/AtlasDecisionEngineContext.docx` (BNPL Bolivia,
5 pilares de riesgo + catálogo de variables de underwriting).

## Errores encontrados → causa raíz → solución → evidencia

### 1. "Añadir salida" no funcionaba (→ error de Revisión de flujo)

- **Causa raíz:** `OutputVariableManager` leía la lista plana `/v1/variables` (filas sin
  `versions[]`) e intentaba `definition.versions[0].id` → `undefined` → el add hacía no-op
  en silencio. Sin salidas, la revisión de flujo reportaba "no hay variables de salida" y,
  sin nodo terminal, "no se alcanza terminal".
- **Solución:** usar el picker slim `/v1/views/pickers/variables` (expone `latestVersionId`),
  igual que `InputVariableManager`. Archivo: `src/features/graph-editor/OutputVariableManager.tsx`.
- **Evidencia:** test `OutputVariableManager.test.tsx` (añade salida con el version id correcto);
  habría fallado con el código anterior.

### 2. Revisión de flujo no distinguía borrador vs bloqueo

- **Causa raíz:** el panel mostraba "errores" sin diferenciar lo que bloquea publicación de un
  aviso de borrador.
- **Solución:** copy reetiquetado ("X bloquean publicación · Y por revisar" + leyenda). Lógica
  pura en `flow-analysis.ts` con 11 tests. Archivo: `src/features/graph-editor/FlowChecklist.tsx`.

### 3. Tabla de Reason Codes con celdas vacías (`—`)

- **Causa raíz:** columnas `code`/`title` que no existen; el backend devuelve `reasonCode` y no
  tiene `title` (sólo `publicMessage`/`internalMessage`).
- **Solución:** columnas corregidas a `reasonCode` + `Mensaje público`/`Mensaje interno`.
  Archivo: `src/resources/resource.config.ts`.

### 4. Filtros: faltaba sincronía con URL y limpiar

- **Causa raíz:** el envío de filtros al backend ya era correcto (params reales), pero faltaban
  sincronía con URL, botón limpiar e indicador de filtros activos que pedía el requerimiento.
- **Solución:** URL sync (replaceState + lectura en montaje), botón "Limpiar", badge de conteo.
  Archivo: `src/pages/ResourceListPage.tsx`, `src/styles/parts/controls.css`.

## Funcionalidades nuevas / completadas

### #9 Tabla desplegable de Algoritmos y Versiones

- Ruta `/algorithms` con búsqueda + filtro de estado (params reales del backend), paginación,
  filas desplegables que cargan las versiones de cada algoritmo bajo demanda, con acciones
  (grafo, validar/compilar, pruebas). Registrada en navegación, route-access y tutorial.
- Archivos: `src/pages/AlgorithmsPage.tsx`, `src/features/algorithms/AlgorithmVersions.tsx`,
  `src/app/(portal)/algorithms/page.next.tsx`, `src/styles/parts/algorithms.css`.

### #7 Encadenar algoritmos (árboles internos)

- **Backend (ya existente, verificado):** nodo RESULT `mode:'REFERENCE'` + API
  `/v1/artifact-versions/:versionId/references`. Guardas: `detectCycle` →
  `CIRCULAR_ARTIFACT_REFERENCE`; `findAncestors`+`computeMaxDepthFrom` →
  `NESTED_TREE_MAX_DEPTH_EXCEEDED` (config `NESTED_TREE_MAX_DEPTH`, def. 5).
- **Frontend (autoría):** `ReferenceNodeEditor.tsx` (selector de artefacto/versión, mapeo de
  entradas y salidas, política de error), `references.api.ts`, lógica pura probada en
  `reference-authoring.ts` (9 tests). Los errores del backend se muestran al usuario.

### #10 Scripts de prueba Py/JS del ejecutor

- `AtlasDecisionEngine/docs/script-prueba.js` y `script-prueba.py` (contrato real del
  `ScriptNodeRunnerService`: JS retorna objeto, Python asigna `result`, builtins seguros).
- Test `AtlasDecisionEngine/test/script-prueba.spec.ts`: **6/6 pasan** contra el ejecutor real
  (resultado correcto JS+PY, variable faltante, error de sintaxis, salida inválida, timeout).

### #2 Explicaciones de negocio

- Conceptos añadidos en `tutorial-content-concepts.ts`: **"Variable de salida"** (con el ejemplo
  pedido) y **"Árbol interno"**. Ya existían Artefacto, Variable, Reason code, Grafo, Despliegue,
  Objetivo, más el panel `ViewExplainer` (negocio + sistemas por vista).

### #9(tooltips)/#2 Tooltips para no técnicos

- Componente accesible `InfoHint` en títulos de página y columnas con jerga (Outcome, SLA,
  sensibilidad, modo de despliegue, cadena de hash).

### #5 Tutoriales robustos

- `useTutorialTarget` endurecido con `MutationObserver`: capta el elemento objetivo aunque
  monte tarde (clave en máquinas lentas), en vez de rendirse a los 2s. Ya existían fallback a
  tooltip centrado, retry tras cambio de ruta y respeto a `prefers-reduced-motion`.

## #4/#8 Seeders (backend) — estado

- **#4 Ya implementado y verificado (código):** `SeedingService` corre en el arranque
  (`OnApplicationBootstrap`) antes de servir, con **upserts idempotentes**, lock advisory entre
  réplicas, separación BOOTSTRAP (todos los entornos) vs MOCKUP (solo dev), log de resumen y
  fallo ruidoso que aborta el arranque. El seeder demo **omite** si ya hay versión, así que **no
  acumula versiones antiguas**.
- **#8 Limpieza destructiva:** al no haber acumulación por parte del seeder, no hay basura
  generada por él. No se ejecutó borrado destructivo: Prisma no logró conectar a la BD
  (`P1001` en localhost:55432) desde este entorno, y no se borran datos sin inspeccionar en vivo.
  Recomendación: correr `prisma migrate status` + una inspección de conteos antes de cualquier
  migración destructiva.

## Método (#15)

Auditoría (docx + ambos repos) → diagnóstico con causa raíz basada en evidencia → correcciones
por fases, priorizando lo bloqueante y verificable → gate por fase. Frontend verificado con
`yarn verify` (format, lint, verify:source 299-líneas, typecheck, tests, build). Backend: spec
del ejecutor corrido localmente (6/6).
