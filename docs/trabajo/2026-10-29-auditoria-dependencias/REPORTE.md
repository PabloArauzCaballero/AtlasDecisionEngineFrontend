> **AVANCE: 2 / 2 microtareas de H1 — 100 %.**

- Fecha: 2026-10-29 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/fix-auditoria-dependencias`
- Peldaño de evidencia alcanzado: `TESTED` (auditoría local y `yarn verify` completo). No se ejercitó el portal en un navegador contra un motor real: los cambios de zod 4 se cubren con las 1679 pruebas unitarias y el E2E de CI.

## Completado

| ID    | Qué se logró                                                                                | Comando                               | Resultado                                   |
| ----- | ------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| H1.M1 | `next` 16.3.8 → 16.4.3 y `dompurify` (resolución) 3.4.13 → 3.4.17                           | `yarn security:audit`                 | PASS · quedan solo `zod` y un moderado      |
| H1.M2 | `zod` 3.25.76 → 4.6.7 y adaptación del código (`z.record` con clave, `ZodType<T, unknown>`) | `yarn security:audit` + `yarn verify` | PASS · exit 0 · 220 archivos / 1679 pruebas |

Antes (`evidencia/audit-antes.txt`): 3 critical · 3 high · 1 moderate · 3 low. Después (`evidencia/audit-despues.txt`): 1 moderate (`baseline-browser-mapping`, informativo, no bloquea).

## A medias

ninguna

## Pendiente

| ID                                     | Estado | Qué lo destraba                                                       |
| -------------------------------------- | ------ | --------------------------------------------------------------------- |
| Avisos moderados/bajos y de desarrollo | TODO   | Fuera de alcance; el control solo bloquea high/critical de producción |

## Evidencia

- `evidencia/audit-antes.txt`, `evidencia/audit-despues.txt`.
- `yarn verify` exit 0 (format, lint `--max-warnings=0`, verify:source, typecheck, tests, build).

## No cubierto

- Navegador contra un motor real: no se probó. Zod 4 cambia mensajes de error y algunos defaults; las pruebas existentes no detectaron diferencias, pero las respuestas reales del motor no se ejercitaron.
- CI en GitHub: pendiente de correr (job SBOM, E2E en build de producción).
- `next` 16.4.x: se probó el build y las pruebas, no el despliegue.

## Desvíos del plan

ninguno

## Riesgos residuales

- `zod` es un salto de versión mayor: un esquema que acepte un valor que antes rechazaba (o al revés) solo se vería con datos reales.
- El aviso de `zod` marca «<4.6.6» y la 3.x no tiene parche, por eso se migró a la 4 en vez de documentar una excepción.

## Decisiones y ambigüedades

- No se tocó `scripts/audit-high.mjs`: el control no se relaja.
