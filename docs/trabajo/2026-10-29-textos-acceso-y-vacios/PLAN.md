# Plan — Textos de acceso y estados vacíos (Motor de decisiones)

- Fecha: 2026-10-29 · Repos afectados: AtlasDecisionEngineFrontend · Predecesor: `docs/trabajo/2026-10-28-rediseno-mobile/`; mismo criterio que el de AtlasAdminPortal
- Resultado observable: quien no recibe el código del segundo factor sabe dónde mirar, y una tabla o catálogo vacío no culpa a filtros que no existen ni mezcla «vacío» con «sin coincidencias».
- Kill-test: abrir una lista sin filtros y leer «No hay registros para los filtros seleccionados».

## Diagnóstico (modo «cambia solo lo que haga falta»)

El acceso (`login-errors.ts`, `LoginPinForm`, `PasswordRecovery`) ya cumple lo que piden las skills: cada error dice qué pasó y qué hacer, no revela si el correo existe y tiene cuenta atrás. Los 19 `EmptyState` explican para qué sirve el área y dan una salida. **No se reescribe nada de eso.** Se aplican las reglas transferibles de `copywriting`, `signup`, `onboarding` y `copy-editing`; urgencia, prueba social y A/B no aplican. Voz del portal: tú.

## Alcance

- IN: `DataTable` (vacío por defecto), `LibrariesPage` (vacío que mezcla dos casos), ayuda del PIN.
- OUT: acceso restante, los otros `EmptyState`, `ResourceListPage` (no se toca su estructura: la frase neutra de `DataTable` cubre sus dos casos), backend, el resto de `empty-state` de una línea (describen un estado concreto y verdadero).
- Ambigüedad: no se añade «reenviar código» (no existe en el flujo; sería funcionalidad nueva).

## H1 — Textos

**CA:** Dado una tabla sin filas, el texto es verdadero con y sin filtros; dado el catálogo de librerías, «vacío» y «sin coincidencias» se dicen distinto; dado el PIN, hay una pista si el correo no llega.
**DoD:** `yarn verify` exit 0.
**Estado:** TODO

| ID    | Microtarea                               | CA (binario)                           | DoD                                       | Estado |
| ----- | ---------------------------------------- | -------------------------------------- | ----------------------------------------- | ------ |
| H1.M1 | Vacío por defecto de `DataTable`         | Ya no dice «los filtros seleccionados» | `vitest DataTable`                        | TODO   |
| H1.M2 | Vacío de `LibrariesPage` con/sin filtros | Dos textos distintos                   | `grep` + typecheck (sin prueba de página) | TODO   |
| H1.M3 | Pista de «no llega» en el PIN            | La frase aparece                       | `vitest LoginPinForm`                     | TODO   |
