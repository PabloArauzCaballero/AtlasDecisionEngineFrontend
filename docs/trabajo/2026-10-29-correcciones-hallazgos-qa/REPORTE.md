> **AVANCE: 3 / 4 — 75,0 %.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-p7u3rw`
- Peldaño de evidencia alcanzado: `TESTED`. No `VERIFIED`: no se observó en navegador tras el cambio.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | OBS-7: causa real = el panel leía `.items` de un array desnudo (el selector `pickers/artifact-versions` devuelve array, ver `views.controller.ts:56`); `filasDeLista` acepta ambas formas | `yarn vitest run src/features/deployments` | PASS (22 pruebas, 2 nuevas) |
| H2.S1.M1 | OBS-10: Escape cierra `TutorialOverlay` | `yarn vitest run src/features/tutorial` | PASS (99 pruebas, 1 nueva) |
| H3.S1.M1 | BUG-7 (hallado en la pasada H4): crear una acción que emite un motivo enviaba `reasonCodeId: "undefined"` y `priority: NaN` (400); `resolverMotivos` completa id y prioridad desde el catálogo y da un error claro si el código no existe | `yarn vitest run src/features/actions` | PASS (30 pruebas) · lint 0 avisos |

## A medias
### H3.S1.M2 — Repetir «Crear acción» en el navegador
- Qué anda: tras el cambio, el `PUT /v1/artifact-versions/9/graph` ya no falla por `reasonCodeId` ni por `priority` (los dos 400 anteriores desaparecieron en clics reales).
- Qué no anda: el guardado completo, porque la versión elegida (borrador vacío de un algoritmo nuevo) no tiene nodos y el servidor responde 400 `nodes must contain at least 1 elements` (regla de dominio válida).
- Qué falta exactamente: repetir sobre un borrador que ya tenga un grafo con al menos un nodo y confirmar `PUT 200` y la fila en `decision_action_reason_mapping`.
- Dónde quedó: rama indicada, compila.

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
