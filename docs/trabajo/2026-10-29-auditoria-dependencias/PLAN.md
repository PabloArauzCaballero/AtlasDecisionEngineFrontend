# Plan — Auditoría de dependencias de producción (Motor)

- Fecha: 2026-10-29 · Repos afectados: AtlasDecisionEngineFrontend · Predecesor: PR #79 (bloqueado por `release-gate`)
- Resultado observable: `yarn security:audit` sale con 0 y el job «Dependencias, secretos e inventario (SBOM)» pasa en CI.
- Kill-test: `yarn security:audit` → exit 1 con 6 avisos high/critical (evidencia/audit-antes.txt).

## Alcance

- IN: `next` (críticas/alta, parche en >=16.4.1), `dompurify` vía `resolutions` (monaco-editor, parche en >=3.4.17), `zod` (alta, parche en >=4.6.6) y lo que arrastre la subida (`eslint-config-next`, código que use la API de zod 3).
- OUT: avisos moderados/bajos de desarrollo, subir otras dependencias, tocar `scripts/audit-high.mjs` (no se relaja el control).
- Ambigüedad: el aviso de zod marca «<4.6.6» y la 3.x no tiene parche; se asume que hay que pasar a zod 4 (mayor). Se mide el costo antes de decidir; si rompe más de lo razonable se detiene y se pregunta.

## H1 — Auditoría en verde

**CA:** Dado el árbol de producción, cuando se ejecuta `yarn security:audit`, entonces no hay avisos high ni critical.
**DoD:** `yarn security:audit` exit 0 · `yarn verify` exit 0 (format, lint, verify:source, typecheck, tests, build).
**Estado:** TODO

| ID    | Microtarea                                 | CA (binario)                 | DoD                                   | Estado |
| ----- | ------------------------------------------ | ---------------------------- | ------------------------------------- | ------ |
| H1.M1 | `next` a >=16.4.1 y `dompurify` a >=3.4.17 | Desaparecen next y dompurify | `yarn security:audit`                 | TODO   |
| H1.M2 | `zod` a >=4.6.6 y adaptar el código        | Desaparece zod               | `yarn security:audit` + `yarn verify` | TODO   |
