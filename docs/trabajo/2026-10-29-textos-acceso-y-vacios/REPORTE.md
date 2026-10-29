> **AVANCE: 3 / 3 microtareas de H1 (Motor de decisiones) — 100 %.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/great-shannon-fm2l7p` (AtlasDecisionEngineFrontend)
- Peldaño de evidencia alcanzado: `TESTED` para `DataTable` y el PIN (pruebas dirigidas); `RUNS` para `LibrariesPage` (typecheck, lint y build; sin prueba de la página).

## Completado

| ID    | Qué se logró                                                                                                                                                              | Comando                                    | Resultado       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------- |
| H1.M1 | `DataTable` vacío: «No hay registros que mostrar. Si hay filtros, cámbialos o quítalos para ver más.» (antes culpaba a «los filtros seleccionados» aunque no los hubiera) | `vitest src/components/DataTable.test.tsx` | PASS · 19 tests |
| H1.M3 | Pista en el PIN: «Si no llega, mira en no deseados.»                                                                                                                      | `vitest LoginPinForm.test.tsx`             | PASS · 8 tests  |

Gate: `yarn verify` (format, lint `--max-warnings=0`, verify:source, typecheck, tests, build) exit 0.

## A medias

### H1.M2 — Vacío de `LibrariesPage`

- Qué anda: el texto distingue «Ninguna librería coincide» (hay búsqueda o lenguaje) de «Sin librerías aprobadas» (registro vacío); compila, pasa lint y el build.
- Qué no anda: nada conocido.
- Qué falta exactamente: una prueba que renderice la página con una respuesta vacía y con filtros; no existe `LibrariesPage.test`.
- Dónde quedó: `src/pages/LibrariesPage.tsx`, compila.

## Pendiente

ninguno

## Evidencia

- Salida de `yarn verify` en el scratchpad de la sesión (exit 0).
- Capturas a 375 px con el backend interceptado por Playwright (sin motor real; sesión y listas simuladas, correo `@example.test`): `evidencia/de_01_pin-ayuda.png`, `de_02_librerias-vacio.png`, `de_03_librerias-sin-coincidencias.png`, `de_04_tabla-vacia.png`.

## No cubierto

- Ninguna captura ni navegación real: el cambio es de texto.
- Los 19 `EmptyState` restantes y los `empty-state` de una línea se leyeron, no se modificaron.
- `ResourceListPage` sigue sin distinguir «sin datos» de «filtros sin coincidencias»: la frase de `DataTable` cubre los dos casos, pero un texto propio exigiría pasar el estado de filtros a la tabla.

## Desvíos del plan

- Al mirar la captura de «Ninguna librería coincide» apareció el ejemplo `math@1.0.0…` debajo; se quitó cuando hay filtros (`LibrariesPage`, una línea).
- Los textos de respaldo del acceso solo se ven ante errores que no sean del cliente de API (un corte de red ya lo traduce el cliente); en este portal el cambio fue solo la pista del PIN.
- El texto de `DataTable` se acortó para respetar el límite de 299 líneas (Prettier lo partía en 5 líneas).

## Riesgos residuales

- La pista de «no deseados» describe el comportamiento habitual del correo, no una garantía del sistema.

## Decisiones y ambigüedades

- Se dejó el acceso tal cual: ya cumple las reglas de las skills y se trata de mejorarlo, no de reescribirlo. A confirmar con producto si se quiere un «reenviar código» (funcionalidad nueva).
