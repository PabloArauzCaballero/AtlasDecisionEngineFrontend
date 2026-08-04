# Coordinación entre agentes

> Hay más de un agente trabajando sobre este repositorio a la vez. Esta nota
> evita que se pisen o se reviertan cambios sin commitear entre sí.

## Riesgo principal de este repositorio

Los agentes comparten **un solo árbol de trabajo**. Cambiar de rama con
archivos sin commitear de otro los arrastra a la rama nueva, y si ese otro
commitea sin darse cuenta, su trabajo acaba en una rama que no es la suya. Ya
ha pasado en repositorios hermanos de este ecosistema.

Reglas mínimas:

- **Nunca `git add -A` ni `git commit -a`.** Añade sólo tus rutas, por nombre.
- **Comprueba `git status` antes de cambiar de rama.** Si hay cambios que no son
  tuyos, no cambies: deja una nota aquí y coordina.
- **Nunca revientes cambios sin commitear** (`git checkout --`, `git reset
--hard`, `git stash` sobre trabajo ajeno).
- Commitea pronto y a menudo: un cambio commiteado ya no se puede perder.

---

## Bitácora

### 2026-08-04 — Agente de **workers adicionales**

Integrando dos workers nuevos (análisis semántico y extractos bancarios) como
capacidades adicionales del producto. Decisiones y contexto:
`AtlasDecisionEngine/docs/workers/` y `docs/adr/ADR-0026`.

**El grueso va en `AtlasDecisionEngine`** (backend): módulo `src/modules/workers/`,
dos tablas nuevas, dos migraciones y dos trabajos de fondo. Aquí, en el portal,
sólo entra la parte visible.

**Rama:** `feat/workers-adicionales-semantico-y-extractos`.

**Lo que toco en este repositorio:**

| Archivo                                    | Cambio                                   |
| ------------------------------------------ | ---------------------------------------- |
| `src/app/(portal)/workers/**`              | **nuevo** — dos rutas                    |
| `src/pages/SemanticAnalysisWorkerPage.tsx` | **nuevo**                                |
| `src/pages/BankStatementWorkerPage.tsx`    | **nuevo**                                |
| `src/features/workers/**`                  | **nuevo** — cliente, tipos y componentes |
| `src/styles/parts/workers.css`             | **nuevo**                                |
| `src/auth/access-policies.ts`              | +1 política (`workers`)                  |
| `src/auth/route-access.ts`                 | +2 reglas de ruta                        |
| `src/navigation/navigation.ts`             | +1 sección «Procesamiento»               |
| `src/styles/global.css`                    | +1 línea de `@import`                    |

**Cuidado con estos tres**, que son los únicos compartidos: `access-policies.ts`,
`route-access.ts` y `navigation.ts` son listas a las que sólo **añado** una
entrada al final de su bloque; y `global.css` recibe **una** línea de `@import`.
Si trabajas en ellos, el conflicto es de una línea y se resuelve conservando las
dos partes.

**No toco** nada de `src/features/tutorial/**`, `src/pages/TutorialCenterPage.tsx`,
`e2e/responsive*`, `playwright.config.ts` ni las hojas de estilo de tutoriales y
responsive.

**Aviso al agente que está en tutoriales y responsive (2026-08-04):** cuando
empecé había ~64 archivos tuyos sin commitear. No he tocado ninguno y no he
cambiado la rama del árbol compartido hasta escribir esta nota. Si ves algo tuyo
en mi rama, es porque estaba sin commitear cuando ramifiqué: **no está perdido**,
sigue en el árbol de trabajo. Commitea lo tuyo cuando puedas para que deje de
viajar entre ramas.
