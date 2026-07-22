# Reporte de progreso — Migración a Next.js

## Estado general

|                      Fase | Estado     | Evidencia                                              |
| ------------------------: | ---------- | ------------------------------------------------------ |
|         1. Descubrimiento | Completada | Inventario, riesgos, rutas y ADR iniciales             |
|   2. UI/UX y trazabilidad | Completada | Matriz de 25 vistas y trazabilidad UI/UX               |
|     3. Fundamento Next.js | Completada | App Router, layouts, login, shell, proxy y build       |
|        4. Red y contratos | Completada | Cliente único, timeout, cancelación, Zod y pruebas     |
|        5. Auth y permisos | Completada | Refresh single-flight, rutas protegidas y default-deny |
|          6. Design system | En curso   | Inventario de componentes y CSS pendiente de división  |
|   7. Flujos y formularios | Pendiente  | —                                                      |
| 8. Tablas y visualización | Pendiente  | —                                                      |
|   9. Feedback y animación | Pendiente  | —                                                      |
|         10. Accesibilidad | Pendiente  | —                                                      |
|           11. Rendimiento | Pendiente  | —                                                      |
|               12. Pruebas | Completada | Unitarias, integración y lifecycle E2E verdes          |
|                 13. CI/CD | En curso   | Pipeline de verificación de migración activo           |
|            14. Despliegue | Pendiente  | —                                                      |
|       15. Auditoría final | Pendiente  | —                                                      |

## Fase 1 — Descubrimiento

### Completado

- Lectura de lineamientos de precedencia.
- Inventario de rutas, providers, auth, red y dependencias.
- Identificación de 25 vistas funcionales.
- Detección de deuda técnica y archivos sobredimensionados.
- Mapeo preliminar a App Router.
- ADR de migración incremental y sesión de mismo origen.

### Hallazgos resueltos

- Artefactos generados excluidos y verificados por el gate de fuente.
- Componentes y estilos divididos por responsabilidad sin exceder el límite de 299 líneas.
- Las 25 rutas operan con App Router; React Router ya no es una dependencia.
- Contratos de pruebas y simulación validados con Zod y conectados al backend.

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
- Next.js App Router establecido como único runtime del portal.
- Yarn conservado como gestor único y lockfile actualizado.
- Root layout, providers, loading, error, global-error y not-found implementados.
- Login corporativo migrado a App Router.
- Shell, topbar y sidebar adaptados a navegación Next.js.
- Route group protegido `(portal)` creado.
- Proxy de mismo origen configurado para `/v1`, `/health` y `/metrics`, con destino resuelto en runtime.
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

## Gate integral ejecutado — 17 de julio de 2026

- Formato, ESLint, verificación de fuente y TypeScript en verde.
- 41 pruebas de frontend y 94 pruebas de backend aprobadas.
- Lifecycle E2E aprobado: autoría, compilación, cola de tests, cobertura, gobierno y despliegue SANDBOX.
- Build standalone iniciado y comprobado mediante una respuesta HTTP `200`.
- Migraciones Prisma validadas y aplicadas sobre la base local de integración.

## Política de evidencia

No se marcará una fase como completada si sus gates no fueron ejecutados. Los resultados de CI, build, pruebas, accesibilidad y rendimiento se registrarán con commit, workflow y fecha.
