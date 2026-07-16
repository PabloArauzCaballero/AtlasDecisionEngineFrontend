# Matriz de paridad — 25 vistas Stitch

## Uso

Esta matriz es el gate visual y funcional para cada ruta durante la migración. Una vista no se considera migrada hasta cumplir todos sus criterios aplicables.

| ID    | Vista                        | Ruta objetivo Next.js                        | Composición a preservar                       | Estados críticos                | Gate      |
| ----- | ---------------------------- | -------------------------------------------- | --------------------------------------------- | ------------------------------- | --------- |
| F0-01 | Inicio de sesión corporativo | `/login`                                     | Panel de acceso, marca, tenant y credenciales | envío, error, sesión restaurada | Pendiente |
| F0-03 | Estado de plataforma         | `/platform-health`                           | métricas, servicios y estado operativo        | carga, degradado, error         | Pendiente |
| F1-01 | Catálogo de variables        | `/variables`                                 | tabla, filtros, estados y acciones            | vacío, paginación, error        | Pendiente |
| F1-06 | Catálogo de reason codes     | `/reason-codes`                              | tabla densa y acciones                        | vacío, paginación, error        | Pendiente |
| F2-01 | Inventario de artefactos     | `/artifacts`                                 | filtros, tabla, estados, acceso a detalle     | carga, vacío, error             | Pendiente |
| F2-03 | Detalle del artefacto        | `/artifacts/[artifactId]`                    | metadatos, versión actual e historial         | not found, error, carga         | Pendiente |
| F2-08 | Editor de grafo              | `/artifact-versions/[versionId]/graph`       | biblioteca, canvas, propiedades y toolbar     | carga, guardado, conflicto      | Pendiente |
| F2-13 | Validar y compilar           | `/artifact-versions/[versionId]/compile`     | wizard, gates y resultado                     | validando, compilando, error    | Pendiente |
| F3-01 | Suites de prueba             | `/artifact-versions/[versionId]/test-suites` | suites, métricas y acciones                   | carga, vacío, ejecución         | Pendiente |
| F3-03 | Casos de prueba              | `/test-suites/[suiteId]/cases`               | tabla de casos y acciones                     | endpoint faltante, vacío, error | Pendiente |
| F3-06 | Resultado de ejecución       | `/test-runs/[runId]`                         | resumen, resultados y evidencia               | carga, not found, error         | Pendiente |
| F3-07 | Cobertura de grafo           | `/test-runs/[runId]/coverage`                | métricas, progreso y nodos                    | carga, sin cobertura, error     | Pendiente |
| F4-01 | Bandeja de revisiones        | `/reviews`                                   | tabla, filtros, prioridad y estado            | endpoint faltante, vacío, error | Pendiente |
| F4-03 | Detalle de solicitud         | `/approval-requests/[requestId]`             | metadatos, gates, diff y decisión             | aprobando, rechazando, error    | Pendiente |
| F4-06 | Ambientes                    | `/environments`                              | cards/tabla operativa y acciones              | carga, vacío, error             | Pendiente |
| F4-07 | Historial de despliegues     | `/deployments`                               | filtros, tabla y estados                      | carga, vacío, error             | Pendiente |
| F5-01 | Simulador de decisión        | `/simulator`                                 | entrada, ejecución y resultado                | ejecutando, validación, error   | Pendiente |
| F5-03 | Cola de revisión manual      | `/manual-reviews`                            | filtros, tabla y prioridad                    | carga, vacío, error             | Pendiente |
| F5-04 | Detalle del caso             | `/manual-reviews/[caseId]`                   | contexto, evidencia y resolución              | guardando, conflicto, error     | Pendiente |
| F6-01 | Buscador de ejecuciones      | `/executions`                                | filtros avanzados y tabla                     | búsqueda, vacío, error          | Pendiente |
| F6-02 | Detalle de ejecución         | `/executions/[executionId]`                  | contexto, trazas y resultado                  | carga, not found, error         | Pendiente |
| F6-05 | Bitácora de auditoría        | `/audit-events`                              | filtros, tabla y metadatos                    | búsqueda, vacío, error          | Pendiente |
| F7-01 | Objetivos de negocio         | `/objectives`                                | tabla, estados y acciones                     | carga, vacío, error             | Pendiente |
| F7-03 | Detalle del objetivo         | `/objectives/[objectiveId]`                  | definición, vínculos y evidencia              | endpoint faltante, not found    | Pendiente |
| F7-07 | Matriz de cobertura          | `/coverage-matrix`                           | matriz, estados y progreso                    | endpoint faltante, vacío, error | Pendiente |

## Criterios comunes de aprobación

Cada vista debe cumplir:

1. Ruta y parámetros correctos.
2. Protección de sesión y permiso según contrato.
3. Paridad de contenido, jerarquía y acciones.
4. Loading específico y sin pantalla congelada.
5. Error recuperable y mensaje no sensible.
6. Estado vacío útil.
7. Navegación por teclado.
8. Foco visible.
9. Responsive en 360 px, 768 px y escritorio.
10. Sin error de hidratación.
11. Sin `fetch` directo en el componente.
12. Sin datos ficticios en producción.
13. Prueba de componente o flujo crítico.
14. Captura comparativa aprobada.

## Endpoints que bloquean paridad completa

Las vistas F3-03, F4-01, F7-03 y F7-07 dependen de endpoints adicionales documentados en el proyecto. Mientras no estén disponibles:

- No se inventarán respuestas.
- No se marcará la vista como completada.
- El estado de integración se documentará explícitamente.
- Los tests podrán usar MSW únicamente como simulación controlada de contrato.
