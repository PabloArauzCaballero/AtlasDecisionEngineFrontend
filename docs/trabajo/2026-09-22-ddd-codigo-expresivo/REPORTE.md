# Reporte — Auditoría DDD: Controles de revertir y suspender despliegue

- Fecha: 2026-09-22 · Plan: [PLAN.md](./PLAN.md) · Rama: dev
- Estado H2: **HECHO** · Avance: 5/5 microtareas HECHO.

## Completado en H1

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Entrada `src/features/deployments/DeploymentControlDialog.tsx` y propietario `src/features/deployments/deployment-controls.api.ts` localizados | inspección de rutas y símbolos | rutas presentes |
| H1.S1.M2 | Referencia del flujo | `PATH=/opt/homebrew/opt/node@22/bin:$PATH yarn test src/features/deployments/deployment-controls.test.ts` | 1 suite; 5/5 pruebas pasan |

## Ejecución H2

Un 409 de rollback/suspensión conserva diálogo y motivo y provoca recarga de la lista; sólo el éxito cierra y confirma.

**Evidencia:** Pruebas dirigidas 7/7; suite completa: 165/165 archivos, 1303/1303 pruebas; `yarn typecheck`, `yarn lint` y Prettier dirigido: 0.

## Límites y resultado del gate

El backend se simula en las pruebas de UI; no se ejecutó el recorrido con un despliegue real.

## Decisión

Se conserva el contrato observado y se evita introducir reglas de negocio sin respaldo. Los cambios de producto y las pruebas de esta pasada se describen arriba; las limitaciones pendientes permanecen explícitas.
