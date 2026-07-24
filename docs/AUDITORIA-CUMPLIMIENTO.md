# Auditoría correctiva — Matriz de cumplimiento

Fecha: 2026‑07‑24 · Ramas: FE `remediation/decision-engine-fixes`, BE `main`/seed.
Alcance revisado: frontend, backend, seeders, endpoints, editor, tutoriales, errores,
vistas de datos, ambientes/despliegues.

## 0. Skills

**Disponibles realmente en este entorno** (no existen skills de React/Next/TS como
paquetes cargables aquí; sí estas): `graphify`, `dataviz`, `simplify`,
`security-review`, `run`, `artifact-design`.

| Skill    | Uso                                                                           | Dónde                                                     |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| graphify | Entender relaciones del código (grafo en `graphify-out/`) antes de tocar.     | Ubicar `useGraphEditor`, adapter, catálogo de tutoriales. |
| dataviz  | Criterio visual de la línea de tiempo y las fases (jerarquía, color legible). | `json-views.tsx` (timeline), `json-views.css`.            |
| simplify | Mantener funciones pequeñas y sin duplicar al refactorizar.                   | `graph-layout.ts`, `json-views.tsx`.                      |

`/reload-skills` es un comando del cliente (no lo ejecuta el modelo); las skills de
frameworks listadas en el pedido no están instaladas como cargables en esta sesión.

## 1. Matriz de cumplimiento

| Requisito                                       | Estado                      | Evidencia                                                             | Causa raíz                                                                   | FE  | BE  | Corrección                                                                                                                                                      | Prueba                 |
| ----------------------------------------------- | --------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Nodo CONDICIÓN cargado dice "sin condición"     | ✅ Corregido                | `ConditionNodeEditor` con `!condition.code`                           | editor lee `config.conditionCode`; el grafo cargado trae `conditions[].code` | sí  | —   | `normalizeLoadedGraph` rellena `config.conditionCode` al cargar                                                                                                 | `graph-layout.test.ts` |
| Grafo no se dibuja                              | ✅ Corregido (previo)       | nodos en esquina                                                      | coords píxel vs. %                                                           | sí  | —   | re‑layout al cargar                                                                                                                                             | sí                     |
| Tutoriales solo en 5 vistas                     | ✅ Corregido                | `interactive-catalog` (5)                                             | falta de cobertura + botón por página                                        | sí  | —   | catálogo de herramientas (12 rutas) + botón por RUTA en `PageHeader`                                                                                            | build                  |
| "No active deployment in SANDBOX"               | ✅ Corregido                | Simulador                                                             | seed despliega solo PROD                                                     | —   | sí  | seed a sandbox/test/prod + `prisma/deploy-demo-all-envs.ts` para BD existente                                                                                   | tsc BE                 |
| Vistas JSON/Tabla/Gráfico                       | ✅                          | `JsonPanel` (10+ usos)                                                | —                                                                            | sí  | —   | 3 pestañas + copiar/descargar JSON + buscar/copiar/CSV en tabla + timeline                                                                                      | `DataInspector.test`   |
| Copiar JSON / copiar tabla / descargar          | ✅                          | header + toolbar de tabla                                             | —                                                                            | sí  | —   | `downloadJson`, TSV al portapapeles, `downloadCsv`                                                                                                              | —                      |
| Línea de tiempo de decisión                     | ✅ Parcial                  | vista Gráfico                                                         | —                                                                            | sí  | —   | traza → timeline vertical (fase, ruta, duración, estado)                                                                                                        | —                      |
| Errores comprensibles + tutorial                | ✅ Ampliado                 | `notifyApiError` + `ERROR_TUTORIALS` (3)                              | catálogo corto                                                               | sí  | —   | +16 códigos reales (`UNDECLARED_OUTPUT`, `SEPARATION_OF_DUTIES_VIOLATION`, `COMPILED_ARTIFACT_NOT_FOUND`, `NESTED_TREE_MAX_DEPTH_EXCEEDED`…) → texto + tutorial | build                  |
| Tooltips por campo de formulario                | ✅                          | `ResourceCreateForm`/`CatalogInput`                                   | —                                                                            | sí  | —   | `InfoHint` en todos los campos con `help`                                                                                                                       | —                      |
| SELECT vs INPUT en formularios                  | 🟡 Parcial                  | catálogos usan `CatalogInput` (select+alta) desde `/v1/views/options` | los campos de enum/catálogo ya son select; falta auditar modales sueltos     | sí  | —   | catálogos ya son selectores; pendiente barrido exhaustivo de cada modal                                                                                         | pendiente              |
| Explicación de negocio por vista (15 preguntas) | 🟡 Parcial                  | `ViewExplainer` (negocio/sistemas) + hints + tutoriales               | cubre muchas vistas, no todas con las 15 preguntas                           | sí  | —   | ampliar `view-explanations` por vista                                                                                                                           | pendiente              |
| Usuarios risk/revisión                          | ⚠️ No aplicable en el motor | esquema sin tabla de usuarios                                         | login por IdP externo                                                        | —   | —   | documentado en `usuarios-roles-y-permisos.md` (se crean en el IdP)                                                                                              | —                      |
| Suites de prueba de ejemplo                     | ✅                          | demo trae una; `seed-suite-prueba.py`                                 | solo en dev                                                                  | —   | sí  | script API + suite en el demo                                                                                                                                   | —                      |
| Playwright de recorridos de error               | 🟡 Pendiente                | `e2e/` detecta runtime                                                | —                                                                            | sí  | —   | añadir recorrido flujo‑sin‑salida→tutorial→corrección                                                                                                           | pendiente              |

Leyenda: ✅ cumplido · 🟡 parcial · ⚠️ fuera del alcance del motor.

## 2. Causas raíz corregidas (resumen)

1. **Condición “no asociada”**: doble convención (`config.conditionCode` vs
   `conditions[].code`). Normalización al cargar unifica ambas.
2. **Grafo invisible**: coordenadas en píxeles del seed contra lienzo en %.
3. **Tutoriales ausentes**: cobertura de 5 rutas → botón global por ruta + catálogo.
4. **Simulador sin deploy**: demo solo en PROD; ahora en los 3 ambientes.
5. **Errores crípticos**: catálogo de 16+ códigos → explicación + tutorial guiado.

## 3. Entregables

- Fixes FE (commits `bc81356`, `7925ae2`, `02367a7`, y este lote).
- Fix BE seed (`39ed734`) + `prisma/deploy-demo-all-envs.ts`.
- `docs/algoritmo-python-listo.py`, `referenciar-algoritmo.py`, `seed-suite-prueba.py`.
- `docs/usuarios-roles-y-permisos.md`, esta matriz.

## 4. Riesgos / pendientes honestos

- **BE no ejecutable desde aquí**: el seed multi‑ambiente y el script se verifican por
  typecheck; hay que correrlos en tu entorno (dev) para confirmar en runtime.
- **Barrido exhaustivo de SELECT en cada modal** y **las 15 preguntas por vista** son
  amplios; quedan parcialmente cubiertos y marcados arriba para continuar.
- **Playwright de error→tutorial**: el motor de tutoriales y el mapeo tienen tests
  unitarios; el recorrido E2E completo queda pendiente.
