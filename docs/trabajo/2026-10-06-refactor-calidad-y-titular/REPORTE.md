# Reporte — Retiro de «Ejecución en vivo» y plan de calidad/titular

> **AVANCE del plan de refactor: 0 / 23 — 0 %.** Este trabajo entregó el diagnóstico y el plan,
> no el refactor.

- Fecha: 2026-10-06 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/gifted-keller-pkwx8g` → `dev` (PR #33)
- Peldaño de evidencia alcanzado: `TESTED` (gate `yarn verify` completo). Sin E2E ni capturas.

## Completado

| ID  | Qué se logró                                                                                          | Comando                  | Resultado                                          |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------- |
| R1  | Se retiró «Ejecución en vivo»: página, ruta, menú, acceso, tutorial, explicador, estilos y E2E propio | `yarn verify`            | PASS — exit 0, 189 archivos / 1477 tests, build OK |
| R2  | «Calidad de la decisión» y «Derechos del titular» salen del menú; rutas y código conservados          | `yarn verify`            | PASS (misma corrida)                               |
| R3  | Diagnóstico con evidencia `archivo:línea` y plan H1/H2 escritos                                       | lectura de FE, BE y CORE | [PLAN.md](./PLAN.md)                               |
| R4  | Rojo heredado de `dev` en `verify:help` (`CaseManualDossier.tsx`) corregido con `Field`               | `yarn verify`            | PASS                                               |

## A medias

Ninguna.

## Pendiente

Las 23 microtareas del plan (H1 y H2) están en `TODO`, salvo H2.S2.M2, que está en
`BLOQUEADO`. Ese bloqueo es una decisión de negocio (A3: qué hacer con ERASURE en el motor),
pendiente de cumplimiento y Pablo Arauz.

## Evidencia

```text
yarn verify
 Test Files  189 passed (189)
      Tests  1477 passed (1477)
✓ Compiled successfully
EXIT 0
```

## No cubierto

- No se corrió ningún E2E de Playwright.
- No hay capturas: el cambio solo quita entradas de menú y vistas, no añade UI.
- El diagnóstico no pudo ver qué datos tiene la base de TEST: la semilla vive en otra rama.

## Desvíos del plan

- La rama local estaba muy atrás de `dev` y se rehízo el cambio sobre `origin/dev`.
- `verify:help` estaba en rojo en `dev` por un archivo ajeno. Se corrigió porque bloqueaba el
  gate de cualquier PR.

## Riesgos residuales

- El endpoint `GET /v1/live-executions/stream` del motor sigue publicado sin pantalla, anotado
  como exento.
- Las rutas `/decision-quality` y `/data-subject-requests` siguen accesibles por URL directa
  para los roles que tienen permiso.

## Decisiones y ambigüedades

- «Si no se arregla, sácalo» se interpretó así: como no se puede arreglar hoy, la vista sale
  del menú, pero el código no se borra, para rehacerla encima. Confirmar con Pablo Arauz.
- Las ambigüedades A1, A2 y A3 del plan quedan abiertas.
