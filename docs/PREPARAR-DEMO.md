# Preparar la demo (limpiar datos viejos + dejar todo funcionando)

Tres pasos para resolver lo que te salía. Se corren en el **repo backend**
(`AtlasDecisionEngine`), con la BD levantada.

## 1. Limpiar los datos de prueba viejos (E2E)

Los artefactos tipo `E2E_CODE_IMPORT_BLOCKED_1784902104551` los dejan los tests
end‑to‑end y ensucian el Simulador ("No active deployment…"). Bórralos así (no
toca el demo real ni el catálogo):

```bash
# primero mira qué borraría (opcional)
DRY_RUN=1 npx ts-node --transpile-only prisma/clean-test-data.ts
# borrar de verdad
npx ts-node --transpile-only prisma/clean-test-data.ts
```

Además, el test `code-import.e2e-spec.ts` ahora **limpia lo que crea** en su
`afterAll`, así que no volverá a acumularse.

## 2. Desplegar el demo en SANDBOX/TEST

El Simulador solo ofrece ambientes no productivos, pero el demo se sembraba solo
en PROD. Despliégalo en los otros ambientes (idempotente):

```bash
npx ts-node --transpile-only prisma/deploy-demo-all-envs.ts
```

(En bases nuevas ya no hace falta: el seeder ahora despliega en sandbox/test/prod.)

## 3. Importar el algoritmo Python

En **Importar Código**, pega [`algoritmo-python-listo.py`](algoritmo-python-listo.py).
Ya trae el header **`# @atlas-contract`** que exige el importador (declara entradas y
salidas antes del código). Sin ese header salía:

> Missing "# @atlas-contract" header — the metadata contract must be declared before the code body

El header debe ir en líneas `#`, con JSON válido, y el código empieza **justo
después** (sin comentarios en medio). El archivo ya está así.

---

Tras 1 y 2, el Simulador corre `BNPL_CREDIT_DECISION` en SANDBOX, y el listado de
artefactos queda limpio de basura de tests.
