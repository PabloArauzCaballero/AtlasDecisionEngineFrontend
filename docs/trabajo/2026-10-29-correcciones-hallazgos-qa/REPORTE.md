> **AVANCE: 10 / 10 — 100,0 %.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-p7u3rw`
- Peldaño de evidencia alcanzado: `TESTED`. No `VERIFIED`: no se observó en navegador tras el cambio.

## Completado

| ID       | Qué se logró                                                                                                                                                                                                                              | Comando                                                               | Resultado                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| H1.S1.M1 | OBS-7: causa real = el panel leía `.items` de un array desnudo (el selector `pickers/artifact-versions` devuelve array, ver `views.controller.ts:56`); `filasDeLista` acepta ambas formas                                                 | `yarn vitest run src/features/deployments`                            | PASS (22 pruebas, 2 nuevas)                                                                                         |
| H2.S1.M1 | OBS-10: Escape cierra `TutorialOverlay`                                                                                                                                                                                                   | `yarn vitest run src/features/tutorial`                               | PASS (99 pruebas, 1 nueva)                                                                                          |
| H3.S1.M1 | BUG-7 (hallado en la pasada H4): crear una acción que emite un motivo enviaba `reasonCodeId: "undefined"` y `priority: NaN` (400); `resolverMotivos` completa id y prioridad desde el catálogo y da un error claro si el código no existe | `yarn vitest run src/features/actions`                                | PASS (30 pruebas) · lint 0 avisos                                                                                   |
| H4.S1.M1 | BUG-8 (hallado en la pasada H4): en 1440×900 el grupo de acciones del editor de grafos tapaba «Cargar»; la barra envuelve y el bloque primario no se encoge                                                                               | medición en Chromium (`elementFromPoint`, script `h4-de-toolbar.cjs`) | antes: 1440×900 tapado · después: 1280, 1440 y 1920 sin solape; lienzo en y=330 (<350) y 570/470 px visibles (>450) |

| H3.S1.M2 | BUG-7 repetido en el navegador: «Crear acción» sobre un borrador con grafo (guardado antes con el editor, 4 nodos) | script `h4-de-accion.cjs` (scratchpad) | `PUT /v1/artifact-versions/9/graph` → 200; BD: `decision_rule_action` (EMIT_REASON) y `decision_action_reason_mapping.reason_code_id = 22` |
| H5.S1.M1 | BUG-9 (hallado en la pasada H4): el id de la entrada de un campo calculado se copiaba del código de la variable (mayúsculas) y el servidor lo rechazaba; `inputIdFromVariableCode` lo normaliza | `yarn vitest run src/features/calculated-fields` | PASS (44 pruebas, 5 nuevas) · lint y typecheck (sin errores en `src/`) |
| H5.S1.M2 | BUG-9 en el navegador con la variable `QA_H4_279386` | script `h4-de-campo.cjs` (scratchpad) | antes: `POST /v1/calculated-fields/1/versions` 400 (campo creado sin versión) · después: `POST /v1/calculated-fields` 201 + `…/3/versions` 201 |
| H6.S1.M1 | OBS-28: «Nuevo despliegue» sólo ofrece versiones desplegables (aprobadas o ya desplegadas) | `yarn vitest run src/features/deployments src/features/actions` | PASS (56) |
| H6.S1.M2 | OBS-28: «Crear acción» sólo ofrece versiones editables y, si no hay ninguna, lo explica; se quitó el aviso falso «desplegada en producción: cambiar sus acciones cambia decisiones» (el servidor no deja cambiarlas) | misma suite · lint 0 avisos · typecheck sin errores en `src/` | PASS |
| H6.S1.M3 | OBS-28 en el navegador | script `h4-de-selectores.cjs` (scratchpad) | antes: 9 versiones (borrador y compilados incluidos); después: 6 `DEPLOYED_TO_STAGING` en despliegue y sólo `QA_H4_… · DRAFT` en acciones |

## A medias

ninguna

## Pendiente

ninguno

## Evidencia

```text
yarn lint -> exit 0 (max-warnings=0)
yarn typecheck -> sin errores en src/; los únicos errores son artefactos generados en .next/dev/types (servidor de desarrollo)
```

## No cubierto

- Prueba visual / navegador de `/deployments` y del tutorial tras el cambio.
- `yarn test` completo y `yarn verify:source` no se corrieron (solo las carpetas tocadas).

## Desvíos del plan

- OBS-7 se había descrito como «texto vacío engañoso»; la causa era de datos (forma de la respuesta), no de texto.

## Riesgos residuales

- Otros consumidores que lean `.items` de un selector pueden tener el mismo defecto (no se auditaron).

## Decisiones y ambigüedades

- El `InteractiveTutorialOverlay` ya cerraba con Escape; solo se tocó el no interactivo.
