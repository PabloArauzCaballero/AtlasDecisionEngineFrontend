# Inventario de vistas implementadas

| ID Stitch | Vista                        | Ruta frontend                               | Endpoint principal                                 |
| --------- | ---------------------------- | ------------------------------------------- | -------------------------------------------------- |
| F0-01     | Inicio de sesión corporativo | `/login`                                    | `POST /v1/session/login`                           |
| F0-03     | Platform Health              | `/platform-health`                          | `GET /health/live`, `/health/ready`                |
| F1-01     | Variable Catalog             | `/variables`                                | `GET /v1/variables`                                |
| F1-06     | Reason Codes Catalog         | `/reason-codes`                             | `GET /v1/reason-codes`                             |
| F2-01     | Inventario de Artefactos     | `/artifacts`                                | `GET /v1/artifacts`                                |
| F2-03     | Detalle del Artefacto        | `/artifacts/:artifactId`                    | `GET /v1/artifacts/:artifactId`                    |
| F2-08     | Editor de Grafo              | `/artifact-versions/:versionId/graph`       | `GET/PUT /v1/artifact-versions/:versionId/graph`   |
| F2-13     | Validar y Compilar           | `/artifact-versions/:versionId/compile`     | `POST .../validate`, `POST .../compile`            |
| F3-01     | Suites de Prueba             | `/artifact-versions/:versionId/test-suites` | `GET /v1/artifact-versions/:versionId/test-suites` |
| F3-03     | Casos de Prueba              | `/test-suites/:suiteId/cases`               | `GET /v1/test-suites/:suiteId/cases`               |
| F3-06     | Resultado de Ejecución       | `/test-runs/:runId`                         | `GET /v1/test-runs/:runId`                         |
| F3-07     | Cobertura de Grafo           | `/test-runs/:runId/coverage`                | `GET /v1/test-runs/:runId`                         |
| F4-01     | Bandeja de Revisiones        | `/reviews`                                  | `GET /v1/approval-requests`                        |
| F4-03     | Detalle de Solicitud         | `/approval-requests/:requestId`             | `GET /v1/approval-requests/:requestId`             |
| F4-06     | Gestión de Ambientes         | `/environments`                             | `GET /v1/environments`                             |
| F4-07     | Historial de Despliegues     | `/deployments`                              | `GET /v1/deployments`                              |
| F5-01     | Simulador de Decisión        | `/simulator`                                | `POST /v1/decisions/:artifactCode`                 |
| F5-03     | Cola de Revisión Manual      | `/manual-reviews`                           | `GET /v1/manual-reviews`                           |
| F5-04     | Detalle de Revisión          | `/manual-reviews/:caseId`                   | `GET/POST /v1/manual-reviews/:caseId/*`            |
| F6-01     | Buscador de Ejecuciones      | `/executions`                               | `GET /v1/audit/executions`                         |
| F6-02     | Detalle de Ejecución         | `/executions/:executionId`                  | `GET /v1/audit/executions/:executionId`            |
| F6-05     | Bitácora de Auditoría        | `/audit-events`                             | `GET /v1/audit/events`                             |
| F7-01     | Objetivos de Negocio         | `/objectives`                               | `GET /v1/traceability/objectives`                  |
| F7-03     | Detalle del Objetivo         | `/objectives/:objectiveId`                  | `GET /v1/traceability/objectives/:objectiveId`     |
| F7-07     | Matriz de Cobertura          | `/coverage-matrix`                          | `GET /v1/traceability/coverage-matrix`             |

Las vistas F3-03, F4-01, F7-03 y F7-07 requieren los endpoints de lectura incluidos en el ZIP independiente `atlas-decision-backend-patch.zip`.
