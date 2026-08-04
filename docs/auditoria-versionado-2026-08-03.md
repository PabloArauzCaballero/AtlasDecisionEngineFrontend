# Auditoría: versionado, solicitudes de cambio y publicación

Fecha: 2026-08-03 · Commit base: `7dd63bb` · Alcance: **este repositorio (frontend)**

## 0. Lo primero: qué se puede auditar aquí y qué no

El prompt maestro está escrito para un repositorio **backend** (PostgreSQL,
Sequelize, migraciones, seeders, transacciones, constraints). Este repositorio es
el **portal Next.js**. No contiene, y no puede contener:

| Pedido del prompt                                                      | Por qué no aplica aquí                                                                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.md`, `programacionBackend.md`, `systemInfo/`, diagramas `.puml` | No existen en este repositorio. Se buscaron; no hay equivalentes.                                                                                              |
| Migraciones, constraints, índices únicos parciales                     | No hay base de datos ni ORM. `package.json` no declara ninguno.                                                                                                |
| Transacciones, locks, optimistic locking                               | No hay capa de persistencia.                                                                                                                                   |
| Boot seeds / mock seeds                                                | No hay seeders. Además, **los usuarios viven en el IdP** (`:3005`), no en el motor: `docs/usuarios-roles-y-permisos.md` lo documenta explícitamente.           |
| Credenciales de prueba por rol                                         | Se crean en el IdP, fuera de este repositorio. No se pueden emitir desde aquí sin inventarlas, y una credencial inventada en un documento es peor que ninguna. |
| Pruebas de concurrencia e idempotencia contra la BD                    | Requieren el backend. Aquí sólo se puede probar el lado cliente del contrato.                                                                                  |

**Lo que sí es auditable y corregible aquí** es la Fase 6 del prompt (frontend) y
la parte de la Fase 8 que es frontend, más una constatación honesta de lo demás.
Las conclusiones sobre el backend son **observaciones desde el contrato HTTP**, no
verificaciones: no se leyó su código.

## 1. Modelo real del sistema (leído del contrato HTTP que consume el portal)

El backend **no expone** el modelo de «solicitud de cambio con detección de
conflictos y merge» del prompt. El modelo que sí existe es:

```txt
artefacto  →  versiones inmutables  →  submit-for-review
           →  approval-request (con pasos, cada uno con requiredRole)
           →  decisión por paso (APPROVE / REJECT)
           →  deployment a un ambiente (SANDBOX / TEST / PROD)
```

Equivalencias con el vocabulario del prompt:

| Prompt                          | Sistema real                                                        |
| ------------------------------- | ------------------------------------------------------------------- |
| Ambiente DEVELOPMENT/PRODUCTION | `/v1/environments` (`SANDBOX`, `TEST`, `PROD`, `isProduction`)      |
| Versión activa por ambiente     | Despliegue con `deploymentStatus = ACTIVE` en ese ambiente          |
| Solicitud de cambio             | `approval-request` creada por `submit-for-review`                   |
| Aprobación administrativa       | `POST /v1/approval-steps/{id}/decisions`                            |
| Promoción                       | `POST /v1/artifact-versions/{id}/deployments`                       |
| Merge / detección de conflictos | **No existe.** No hay endpoint, estado ni tipo de dato equivalente. |

Estados de despliegue del dominio: `PREPARING, ACTIVE, SUSPENDED, SUPERSEDED,
ROLLED_BACK, FAILED` (`src/resources/resource.config.ts`). Es decir, la
invariante «una sola versión activa por ambiente» **sí está modelada** — la
pregunta abierta es si el backend la impone con un constraint. Este repositorio
no puede responderla.

## 2. Defectos encontrados y corregidos

### D1 · La pantalla de aprobación fabricaba evidencia (grave)

`ApprovalRequestDetailPage` pintaba cuatro gates fijos —«Compilación
determinista», «Suite bloqueante aprobada», «Cobertura mínima alcanzada»,
«Integridad de grafo verificada»— cada uno con `<StatusBadge value="PASSED" />`
escrito a mano, **sin mirar la respuesta del backend**. Un revisor aprobaba un
despliegue a producción creyendo que cuatro comprobaciones habían pasado cuando
no se había comprobado ninguna.

Corrección: `src/features/governance/approval-gates.ts` lee los resultados
reales de la solicitud o de la versión; si no llegan, la pantalla **dice que no
llegaron** en vez de rellenarlos. Un gate sin estado no cuenta como aprobado.

### D2 · Cualquiera que pudiera abrir la solicitud podía firmarla

Los botones «Aprobar Despliegue» y «Rechazar» se mostraban habilitados a todo
rol con acceso a la ruta — que incluye `AUDITOR`, cuyo trabajo es leer. El
backend rechazaría el POST, pero el portal invitaba a intentarlo y no explicaba
nada.

Corrección: `src/features/governance/decision-policy.ts` decide a partir del
`requiredRole` **que el propio backend declara en el paso pendiente**, no de una
lista paralela que se desincronizaría. Añade además:

- El paso activo es el pendiente **de menor `stepOrder`**, no el primero del
  arreglo (antes coincidía sólo si el backend lo mandaba ordenado).
- **Separación de funciones**: quien solicitó la revisión no la decide él mismo.
- Solicitud en estado terminal → no admite decisiones.
- Sin `requiredRole` declarado → sólo `RISK_APPROVER` o `COMPLIANCE` (negar por
  defecto, no habilitar por defecto).

Cuando no se puede decidir, la vista **explica cuál es el rol que falta** en vez
de mostrar un botón muerto.

### D3 · Firmar era un solo clic, sin confirmación

Firmar un paso es irreversible y queda en la bitácora con tu nombre. No había
paso intermedio. Corrección: `DecisionConfirmDialog.tsx` muestra artefacto,
versión, rol con el que se firma, consecuencia, estado de la evidencia y el
comentario que quedará registrado. Usa `ModalDialog`, que ya aplica
`useDialogFocus()` según la convención del repositorio.

### D4 · Ninguna clave de idempotencia en una acción administrativa

Un tiempo agotado seguido de un segundo clic podía registrar dos decisiones
sobre el mismo paso. Corrección: `idempotency.ts` genera una clave por _intento_
(no por clic) y viaja en `Idempotency-Key`; se reutiliza en los reintentos del
mismo intento y se renueva al empezar uno nuevo.

**Limitación real:** si el backend ignora la cabecera, el duplicado ocurre igual.
Enviarla es la mitad del contrato que depende de este lado.

### D5 · Un 409 se mostraba como un error cualquiera

Si otra persona decidía el paso mientras lo mirabas, aparecía el mensaje crudo
del servidor y los datos en pantalla seguían siendo los viejos. Corrección:
`useApprovalDecision.ts` detecta `kind === 'conflict'`, relee el estado real y
muestra un aviso que explica qué pasó. Igual para `forbidden`.

### D6 · La ficha del artefacto mentía sobre qué versión manda

Mostraba `versions[0]` —la más reciente del historial— bajo el título «Current
Version · Governed». Una versión recién creada aparecía como si estuviera
decidiendo en producción.

Corrección: `EnvironmentHeadsPanel.tsx` consulta los despliegues del artefacto y
muestra **la versión vigente en cada ambiente**, derivada de los despliegues
activos. El panel viejo se conserva, renombrado a «Última versión del historial ·
Puede no estar desplegada».

Además: el portal **no puede imponer** «una sola versión activa en producción»,
pero ya no la esconde — si un ambiente devuelve más de un despliegue activo, se
cuenta y se señala en rojo (`conflictingHeads`).

### D7 · «Resumen de Cambios» no comparaba nada

El panel mostraba un bloque fijo —«Graph and contract changes · Consulte el
checksum»— con icono de diff y sin ninguna comparación detrás. El revisor tenía
que aprobar sin saber qué cambiaba.

Corrección: `version-diff.ts` compara dos instantáneas del grafo **por
identificador estable de dominio** (`nodes[].key`, `edges[].key`,
`actions[].code`, `variables[].code`), no por texto: así un reordenamiento del
arreglo no aparece como cambio y un renombrado sí. Produce rutas legibles del
tipo `nodes.EVAL_SCORE.label`, exactamente el formato que pide el §6.2 del
encargo. Los cambios que sólo mueven el dibujo (`x`, `y`, `order`) se informan
igual, pero marcados, para que no se confundan con lógica.

Se calcula en el cliente a partir de `/v1/artifact-versions/{id}/graph`, que ya
existía: **no hizo falta ningún endpoint nuevo**. Se muestra en la pantalla de
aprobación (contra el origen o contra lo vigente en cada ambiente) y en la
pestaña de versiones de la ficha del artefacto.

### D8 · Nadie avisaba de que la base había avanzado

Escenario del §6.1 del encargo: una versión se crea sobre v4, mientras espera
revisión producción pasa a v6, y aprobarla revierte lo que ya está decidiendo.
No había ninguna señal.

Corrección: `diff-bases.ts` compara el `sourceVersionId` de la versión con la
versión vigente en cada ambiente. Si difieren, la pantalla lo advierte por
nombre de ambiente y ofrece comparar **contra lo que hoy decide**, no sólo
contra el origen. Es detección y visualización de conflicto (§11.3); la
resolución sigue necesitando backend.

## 3. Matriz de cumplimiento

Estado: ✅ cumple · 🟡 parcial · ⛔ no aplica en este repositorio · ❌ no cumple

| #     | Requisito (§ del prompt)                             | Estado | Evidencia                                                                            |
| ----- | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| 1     | Cada artefacto reconoce sus ambientes                | 🟡     | Visible en el portal (`EnvironmentHeadsPanel`); la garantía es del backend           |
| 2     | Un head por artefacto y ambiente                     | ⛔→🟡  | No imponible aquí; **violación ahora visible** (`environment-heads.ts`)              |
| 3     | Una sola versión activa en producción                | ⛔→🟡  | Igual que 2. Requiere constraint en la BD                                            |
| 4     | La regla se mantiene bajo concurrencia               | ⛔     | Requiere transacciones/locks del backend                                             |
| 5     | Versiones históricas no se sobrescriben              | ⛔     | El portal nunca hace PUT sobre una versión publicada; el resto es backend            |
| 6     | Usuario normal sólo genera solicitudes               | ✅     | `ReviewsPage` sólo hace `submit-for-review`; no hay ruta de publicación directa      |
| 7     | Usuario normal no publica ni hace merge              | ✅     | `DeploymentsPage` exige `PLATFORM_ADMIN`; backend revalida                           |
| 8     | El administrador puede aprobar o rechazar            | ✅     | `ApprovalRequestDetailPage` + `decision-policy.ts`                                   |
| 9     | Merge a DEVELOPMENT                                  | ⛔     | No existe el concepto de merge en el backend                                         |
| 10    | Promoción a PRODUCTION                               | ✅     | `DeploymentCreateForm` → `POST /v1/artifact-versions/{id}/deployments`               |
| 11–12 | Los conflictos se detectan y se muestran             | 🟡     | Base desactualizada detectada y avisada (`diff-bases.ts`); el merge no existe        |
| 13–15 | Bloqueo por conflicto, resoluciones registradas      | ⛔     | **No hay API de resolución ni de merge.** Ver §4                                     |
| 16    | Merge transaccional                                  | ⛔     | Backend                                                                              |
| 17    | Los reintentos no duplican versiones                 | 🟡     | Clave de idempotencia enviada (`idempotency.ts`); el backend debe honrarla           |
| 18    | Cada acción crítica queda auditada                   | 🟡     | El portal consume `/v1/audit/events`; escribirla es del backend                      |
| 19–21 | Seeders idempotentes y prohibidos en producción      | ⛔     | No hay seeders en este repositorio                                                   |
| 22    | Credenciales funcionales por rol                     | ⛔     | Los usuarios viven en el IdP. Ver §5                                                 |
| 23    | Pruebas de autorización con casos negativos          | ✅     | `decision-policy.test.ts` (5 casos negativos) + `ApprovalRequestDetailPage.test.tsx` |
| §15.4 | Pruebas de frontend sobre las vistas nuevas          | ✅     | `e2e/governance-decision.spec.ts`: render, contraste en 2 temas y desbordamiento     |
| 24    | OpenAPI y documentación reflejan lo real             | 🟡     | Este documento; no hay OpenAPI en este repositorio                                   |
| 25    | No se eliminaron funcionalidades                     | ✅     | Suite completa: 617 pruebas en verde                                                 |
| 26    | No se introdujeron secretos                          | ✅     | Ningún archivo nuevo contiene credenciales                                           |
| 27    | Nada se declara funcionando sin evidencia            | ✅     | §6                                                                                   |
| §11.1 | Ver versión actual por ambiente                      | ✅     | `EnvironmentHeadsPanel.tsx`                                                          |
| §11.1 | Diferencias entre versiones (diff)                   | ✅     | `version-diff.ts` + `VersionDiffPanel.tsx`, en la ficha y en la aprobación           |
| §6.2  | Merge/comparación consciente del dominio             | 🟡     | Comparación estructural por identificador estable; el merge sigue siendo del backend |
| §11.4 | Acciones administrativas sólo visibles al autorizado | ✅     | `decision-policy.ts`                                                                 |
| §11.5 | Confirmación antes de una acción crítica             | ✅     | `DecisionConfirmDialog.tsx`                                                          |
| §15.4 | Manejo de 409 y reintentos seguros                   | ✅     | `useApprovalDecision.ts` + prueba de 409                                             |

## 4. Lo que NO se implementó, y por qué

**Resolución de conflictos y merge (§6.4, §6.5, §11.3).** No existe en el backend:
no hay endpoint de merge, ni estado `CONFLICTED`, ni persistencia de
resoluciones. Ofrecer `KEEP_TARGET` / `KEEP_REQUEST` / `MANUAL_VALUE` en el
portal sería un formulario que **ningún endpoint puede aceptar**: un botón que
aparenta gobernar y no gobierna nada.

Lo que **sí** se hizo, porque no necesitaba backend nuevo (ver D7): comparar y
avisar. Falta, del lado del backend: modelo de solicitud con `baseVersionId`,
persistencia de conflictos y resoluciones, y un merge transaccional. El
comparador estructural que consumiría esa UI ya está escrito y probado
(`version-diff.ts`), así que esa parte no habrá que rehacerla.

**Roles del prompt (`DECISION_ENGINE_ADMIN`, usuario solicitante).** No se
crearon: el catálogo real (`src/auth/access-policies.ts`) ya tiene
`RISK_APPROVER`, `COMPLIANCE`, `PLATFORM_ADMIN`, `AUDITOR`… El prompt pide
reutilizar antes que inventar, y aquí procede reutilizar.

## 5. Credenciales de prueba

**No se pueden entregar desde este repositorio.** El portal autentica contra un
Identity Provider aparte (`:3005`); los usuarios y sus roles viven ahí y el
esquema del Decision Engine no tiene tabla de usuarios
(`docs/usuarios-roles-y-permisos.md`).

Para probar los escenarios de autorización hacen falta, creados en el IdP:

| Rol              | Puede                                   | Debe recibir 403 en             |
| ---------------- | --------------------------------------- | ------------------------------- |
| `RISK_APPROVER`  | Decidir el paso que declare su rol      | Desplegar (`PLATFORM_ADMIN`)    |
| `COMPLIANCE`     | Decidir su paso, ver auditoría          | Desplegar, autoría de grafo     |
| `AUDITOR`        | Leer artefactos, ejecuciones, auditoría | **Toda decisión de aprobación** |
| `PLATFORM_ADMIN` | Desplegar y promover                    | —                               |
| `RISK_ANALYST`   | Crear versiones y enviarlas a revisión  | Aprobar su propia solicitud     |

El caso negativo más importante —`AUDITOR` frente a un paso de aprobación— ya
está cubierto **sin necesidad del IdP** en
`src/pages/ApprovalRequestDetailPage.test.tsx`.

## 6. Evidencia ejecutada

```txt
npx eslint . --max-warnings=0        → sin hallazgos
npx prettier --check .               → All matched files use Prettier code style!
node scripts/verify-source.mjs       → passed (547 archivos)
node scripts/verify-conventions.mjs  → passed
npx tsc --noEmit                     → sin errores
npx vitest run                       → 82 archivos · 617 pruebas · todas en verde
npx next build                       → compilado sin errores
npx playwright test --config playwright.prod.config.ts
                                     → 74 pasan · 6 omitidas · 7,6 min
```

La corrida E2E es la canónica del proyecto: contra el artefacto construido, sin
compilación al vuelo. Las 6 omitidas son las de `real-backend.spec.ts`, que se
saltan solas cuando no hay un Decision Engine detrás.

### Una brecha de medición que había que cerrar

La primera corrida E2E daba 59 en verde **sin haber pintado ni una sola de las
superficies nuevas**. Las barridas de contraste y de desbordamiento recorren
rutas de LISTADO, y el motor simulado devuelve páginas vacías; el diff, la
versión vigente por ambiente, el aviso de invariante rota y el diálogo de firma
viven en rutas de DETALLE y sólo existen con objetos detrás. Era exactamente el
riesgo que advierte `CLAUDE.md`: medir una cabecera creyendo medir la vista.

Se cerró con `e2e/support/governance-backend.ts` (escenario de gobierno: un paso
firmable, un gate en rojo, dos despliegues ACTIVE en PROD, un origen distinto de
lo vigente y dos grafos que difieren) y `e2e/governance-decision.spec.ts`, que
comprueba que esas superficies **aparecen**, que se leen con AA 4,5:1 en los dos
temas y que no empujan la página a 360 px. 15 pruebas, todas en verde a la
primera corrida.

Las parejas de color usadas ya estaban cubiertas por `theme-contrast.test.ts`:
los alias semánticos resuelven a tokens medidos (`--danger-text` → `--danger`,
`--text-muted` → `--muted`, `--surface-muted` → `--surface-sunken`). La medición
sobre el DOM ya pintado lo confirma en ambos temas.

**No ejecutado, y por qué:**

- `yarn` como tal falla en esta máquina: Node 24.18.1 contra el motor declarado
  `>=20.9 <24`. Por eso los comandos se ejecutaron con `npx`. Es un desajuste del
  entorno local, no del cambio.
- Cualquier prueba de concurrencia, idempotencia real o constraint de base de
  datos: necesitan el backend. Siguen sin verificarse (§7).
- El diff y el aviso de base desactualizada están probados contra respuestas
  simuladas, no contra el backend real: la forma de `sourceVersionId` y del grafo
  se tomó del código que ya los consume (`ArtifactDetailPage`, `useGraphEditor`).

## 7. Riesgos pendientes

1. **La invariante de producción sigue sin verificarse.** El portal la muestra;
   nadie ha comprobado que la base la imponga. Es el riesgo número uno.
2. **La idempotencia depende del backend.** Si ignora `Idempotency-Key`, el
   reintento duplica igual.
3. **Hay diff y aviso, pero no resolución.** Dos personas editando el mismo grafo
   siguen pisándose: el portal ahora lo _enseña_ (§D7, §D8), pero sin merge en el
   backend la única salida sigue siendo coordinarse a mano.
4. **El diff depende de que el grafo traiga identificadores estables.** Si un
   elemento llega sin `key`/`code`, se empareja por posición y la ruta lo declara
   (`nodes.#3`). Es visible, no silencioso, pero conviene que el backend garantice
   el identificador.
5. **`hasAnyRole` concede todo a `PLATFORM_ADMIN`.** Es la convención del
   repositorio, pero significa que un administrador de plataforma ve habilitado
   un paso de `COMPLIANCE`. El backend decide; si allí no lo es, verá un 403.
6. **Las claves donde el backend cuelga los gates son una conjetura**
   (`gates`, `qualityGates`, `checks`, `validations`, `evidence`). Si usa otro
   nombre, la pantalla mostrará «sin datos» — que es el fallo seguro correcto,
   pero conviene confirmar el nombre real y fijarlo.
