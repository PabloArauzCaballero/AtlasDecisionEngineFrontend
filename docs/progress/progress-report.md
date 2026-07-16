# Reporte de progreso — Migración a Next.js

## Estado general

| Fase | Estado | Evidencia |
|---:|---|---|
| 1. Descubrimiento | Completada | Inventario, riesgos, rutas y ADR iniciales |
| 2. UI/UX y trazabilidad | Completada | Matriz de 25 vistas y trazabilidad UI/UX |
| 3. Fundamento Next.js | En curso | Rama de migración creada |
| 4. Red y contratos | Pendiente | — |
| 5. Auth y permisos | Pendiente | — |
| 6. Design system | Pendiente | — |
| 7. Flujos y formularios | Pendiente | — |
| 8. Tablas y visualización | Pendiente | — |
| 9. Feedback y animación | Pendiente | — |
| 10. Accesibilidad | Pendiente | — |
| 11. Rendimiento | Pendiente | — |
| 12. Pruebas | Pendiente | — |
| 13. CI/CD | Pendiente | — |
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

### Hallazgos abiertos

- Docker mezcla Yarn y npm.
- `dist/` y `*.tsbuildinfo` están versionados.
- `GraphEditorPage.tsx` supera 300 líneas.
- `global.css` tiene 1.964 líneas.
- El baseline de instalación, lint, typecheck, tests y build aún debe ejecutarse en un entorno reproducible.

## Fase 2 — UI/UX y trazabilidad

### Completado

- Revisión de `docs/STITCH_VISUAL_QA.md`.
- Inventario de 25 referencias Stitch.
- Creación de `docs/ui/ui-ux-source-traceability.md`.
- Creación de `docs/ui/stitch-view-parity-matrix.md`.
- ADR de paridad visual antes de rediseñar.
- Definición de estados obligatorios de carga, vacío, error, permiso y mutación.
- Definición de criterios responsive, accesibilidad e hidratación.

### Gate alcanzado

La migración puede avanzar a fundamento Next.js sin modificar arbitrariamente las vistas.

## Fase 3 — Fundamento Next.js

### En curso

- Rama `migration/next-app-router` creada desde `main`.
- Permisos de escritura verificados.

### Siguiente trabajo

1. Añadir Next.js App Router sin eliminar inmediatamente Vite.
2. Mantener Yarn como gestor de paquetes.
3. Crear layouts, providers y boundaries base.
4. Configurar proxy de mismo origen.
5. Ejecutar CI con lockfile congelado.
6. Migrar rutas por grupos funcionales.

## Política de evidencia

No se marcará una fase como completada si sus gates no fueron ejecutados. Los resultados de CI, build, tests, accesibilidad y rendimiento se registrarán aquí con commit y fecha.
