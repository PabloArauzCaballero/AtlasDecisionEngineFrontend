# Plan — DDD y código expresivo: Controles de revertir y suspender despliegue

- Fecha: 2026-09-22 · Repo: AtlasDecisionEngineFrontend (frontend web) · Predecesor: ninguno en esta pasada
- Resultado observable de esta pasada: flujo, regla, evidencia y próxima comprobación definidos sin modificar producto.
- Kill-test: si no se puede seguir `src/features/deployments/DeploymentControlDialog.tsx` → `src/features/deployments/deployment-controls.api.ts`, el diagnóstico no está completo.

## Alcance

- IN: `src/features/deployments/DeploymentControlDialog.tsx`, `src/features/deployments/deployment-controls.api.ts`, `src/features/deployments/DeploymentControlDialog.test.tsx`, `src/pages/DeploymentsPage.tsx`, contrato y prueba de referencia del flujo.
- OUT: migraciones, cambios de API, UX o reglas no confirmadas; resto del repo.
- Ambigüedad registrada: No anunciar reversión por timeout sin respuesta confirmada.

## H1 — Diagnóstico y referencia

**CA:** Dado el flujo existente, cuando se inspeccionan entrada, decisión y resultado, entonces la regla tiene un propietario y una prueba de referencia identificables.
**DoD:** inspección de los archivos citados y `PATH=/opt/homebrew/opt/node@22/bin:$PATH yarn test src/features/deployments/deployment-controls.test.ts` con el resultado literal del reporte.
**Estado:** HECHO

### H1.S1 — Rastrear y probar

**CA:** Dado el checkout actual, cuando se sigue el flujo, entonces se distingue regla de coordinación. **DoD:** rutas y símbolos reales registrados abajo. **Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Localizar entrada y propietario | Ambas rutas existen y se identificó la regla | `test -f 'src/features/deployments/DeploymentControlDialog.tsx' && test -f 'src/features/deployments/deployment-controls.api.ts'` → salida 0 | HECHO |
| H1.S1.M2 | Fijar referencia | El chequeo dirigido termina con salida 0 | `PATH=/opt/homebrew/opt/node@22/bin:$PATH yarn test src/features/deployments/deployment-controls.test.ts` → 1 suite; 5/5 pruebas pasan | HECHO |

**Regla observada:** Motivo explícito, acción única mientras espera y resultado decidido por el servidor.

## H2 — Próxima capacidad acotada

**CA:** Dado el contrato confirmado, cuando se ejerce la condición límite del flujo, entonces el resultado visible o persistido coincide con la regla y un rechazo no produce efecto parcial.
**DoD:** prueba de comportamiento dirigida, verificación de contrato y recorrido real si se modifica código; reporte con salida literal.
**Estado:** HECHO

### H2.S1 — Confirmar semántica antes de refactorizar

**CA:** La condición límite tiene resultado esperado documentado. **DoD:** prueba dirigida y revisión del contrato vigente. **Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Probar rechazo 409 sin confirmar la operación | El diálogo conserva motivo y no anuncia éxito | `PATH=/opt/homebrew/opt/node@22/bin:$PATH yarn test src/features/deployments/DeploymentControlDialog.test.tsx` → salida 0 | HECHO |
| H2.S1.M2 | Probar confirmación posterior | Solo una respuesta exitosa dispara el refresco y cierra el diálogo | mismo comando → salida 0 | HECHO |
| H2.S1.M3 | Refrescar el listado cuando el Motor responde conflicto | Un 409 provoca recarga sin anunciar éxito ni cerrar el motivo | mismo comando y `PATH=/opt/homebrew/opt/node@22/bin:$PATH yarn typecheck` → salida 0 | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| No anunciar reversión por timeout sin respuesta confirmada. | Resultado o contrato falso | Confirmar con código, contrato y prueba antes de editar producto |

## Decisión de diseño

El propietario observado es `src/features/deployments/deployment-controls.api.ts`. No se introduce una capa DDD nueva por nombre. Una refactorización futura necesitará mostrar una llamada más clara y la misma semántica en la entrada real, con prueba roja antes de cambiar implementación. Si la comprobación H2 demuestra que el diseño actual ya protege la regla, se registra como DESCARTADO el cambio de código.
