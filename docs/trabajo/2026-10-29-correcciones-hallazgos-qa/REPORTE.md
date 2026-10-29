> **AVANCE: 2 / 2 — 100,0 %.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-p7u3rw`
- Peldaño de evidencia alcanzado: `TESTED`. No `VERIFIED`: no se observó en navegador tras el cambio.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | OBS-7: causa real = el panel leía `.items` de un array desnudo (el selector `pickers/artifact-versions` devuelve array, ver `views.controller.ts:56`); `filasDeLista` acepta ambas formas | `yarn vitest run src/features/deployments` | PASS (22 pruebas, 2 nuevas) |
| H2.S1.M1 | OBS-10: Escape cierra `TutorialOverlay` | `yarn vitest run src/features/tutorial` | PASS (99 pruebas, 1 nueva) |

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
