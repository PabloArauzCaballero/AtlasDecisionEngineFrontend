# Reporte de progreso — Migración a Next.js

## Estado general

| Fase | Estado | Evidencia |
|---:|---|---|
| 1. Descubrimiento | Completada | Inventario, riesgos, rutas y ADR iniciales |
| 2. UI/UX y trazabilidad | Completada | Matriz de 25 vistas y trazabilidad UI/UX |
| 3. Fundamento Next.js | Completada | App Router, layouts, login, shell, rewrites y build |
| 4. Red y contratos | Completada | Cliente único, timeout, cancelación, Zod y pruebas |
| 5. Auth y permisos | Completada | Refresh single-flight, rutas protegidas y default-deny |
| 6. Design system | En curso | Inventario de componentes y CSS pendiente de división |
| 7. Flujos y formularios | Pendiente | — |
| 8. Tablas y visualización | Pendiente | — |
| 9. Feedback y animación | Pendiente | — |
| 10. Accesibilidad | Pendiente | — |
| 11. Rendimiento | Pendiente | — |
| 12. Pruebas | En curso | Unitarias activas; integración y e2e pendientes |
| 13. CI/CD | En curso | Pipeline de verificación de migración activo |
| 14. Despliegue | Pendiente | — |
| 15. Auditoría final | Pendiente | — |

## Fase 1 — Descubrimiento

### Completado

- Lectura de lineamientos de precedencia.
- Inventario de rutas, providers, auth, red y dependencias.
- Identificación de 25 vistas funcionales.
- Detección de deuda técnica y archivos sobredimensionados.
- Mapeo preliminar a App Router.
- ADR de migración incremental y sesión de mismo origen.

### Hallazgos que continúan abiertos

- `dist/` y `*.tsbuildinfo` siguen versionados y deben retirarse al finalizar la transición.
- `GraphEditorPage.tsx` supera 300 líneas y requiere separación por responsabilidad.
- `global.css` tiene 1.964 líneas y requiere división sin regresión visual.
- React Router permanece como dependencia temporal hasta migrar las 25 rutas.

## Fase 2 — UI/UX y trazabilidad

### Completado

- Revisión de `docs/STITCH_VISUAL_QA.md`.
- Inventario de 25 referencias Stitch.
- Creación de `docs/ui/ui-ux-source-traceability.md`.
- Creación de `docs/ui/stitch-view-parity-matrix.md`.
- ADR de paridad visual antes de rediseñar.
- Definición de estados obligatorios de carga, vacío, error, permiso y mutación.
- Definición de criterios responsive, accesibilidad e hidratación.

## Fase 3 — Fundamento Next.js

### Completado

- Rama `migration/next-app-router` creada desde `main`.
- Next.js App Router añadido conservando temporalmente los scripts Vite de rollback.
- Yarn conservado como gestor único y lockfile actualizado.
- Root layout, providers, loading, error, global-error y not-found implementados.
- Login corporativo migrado a App Router.
- Shell, topbar y sidebar adaptados a navegación Next.js.
- Route group protegido `(portal)` creado.
- Proxy de mismo origen configurado para `/v1`, `/health` y `/metrics`.
- Salida `standalone` habilitada.
- `/platform-health` migrada como primera ruta operacional.

### Gate ejecutado

El workflow `Verify Next migration`, ejecución `29474029247`, completó correctamente sobre el commit `89a073a4a34e393aade3795c7f4e6ceff194d7b7`:

- `yarn install --frozen-lockfile`.
- Prettier.
- ESLint.
- TypeScript.
- Vitest.
- `next build` de producción.

## Fase 4 — Red y contratos

### Completado

- Un único cliente para tráfico público de sesión y tráfico autenticado.
- Rechazo de URLs absolutas o protocol-relative para evitar salidas no controladas.
- Timeout configurable y cancelación mediante `AbortSignal`.
- Propagación de cancelación desde TanStack Query.
- Normalización de errores de red, timeout, cancelación, validación, permisos, conflicto, rate limit y contrato.
- Validación Zod para configuración pública y sesión de identidad.
- Validación opcional de respuestas críticas antes de convertir `unknown` en DTO seguro.
- Retry único después de `401` sin cerrar sesión incorrectamente ante un `403` posterior.
- Pruebas de timeout, cancelación, contrato, rutas inseguras y refresh.

## Fase 5 — Auth y permisos

### Completado

- Refresh token permanece en cookie HttpOnly y el access token continúa únicamente en memoria.
- Refresh coordinado single-flight conservado.
- Expiración anticipada de access token conservada.
- Redirección a login ante sesión ausente o refresh fallido.
- Políticas de roles centralizadas y reutilizadas por rutas y navegación.
- Reglas explícitas para rutas estáticas y dinámicas.
- Rutas desconocidas denegadas por defecto.
- Estado 403 diferenciado de sesión expirada.
- La autorización del frontend se documenta como UX defensiva; el backend sigue siendo la autoridad.
- Pruebas de aliases, rutas dinámicas y default-deny.

## Próximo gate

La fase 6 debe:

1. Inventariar primitivas actuales.
2. Dividir tokens, layout, feedback, tablas y features del CSS monolítico.
3. Mantener paridad visual con las capturas Stitch.
4. Evitar una introducción masiva de componentes que cambie el diseño.
5. Preparar la migración de las 23 rutas restantes sin componentes Dios.

## Política de evidencia

No se marcará una fase como completada si sus gates no fueron ejecutados. Los resultados de CI, build, pruebas, accesibilidad y rendimiento se registrarán con commit, workflow y fecha.
