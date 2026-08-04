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
| 11–15 | Detección, visualización y resolución de conflictos  | ⛔     | **No hay API de conflictos.** Ver §4                                                 |
| 16    | Merge transaccional                                  | ⛔     | Backend                                                                              |
| 17    | Los reintentos no duplican versiones                 | 🟡     | Clave de idempotencia enviada (`idempotency.ts`); el backend debe honrarla           |
| 18    | Cada acción crítica queda auditada                   | 🟡     | El portal consume `/v1/audit/events`; escribirla es del backend                      |
| 19–21 | Seeders idempotentes y prohibidos en producción      | ⛔     | No hay seeders en este repositorio                                                   |
| 22    | Credenciales funcionales por rol                     | ⛔     | Los usuarios viven en el IdP. Ver §5                                                 |
| 23    | Pruebas de autorización con casos negativos          | ✅     | `decision-policy.test.ts` (5 casos negativos) + `ApprovalRequestDetailPage.test.tsx` |
| 24    | OpenAPI y documentación reflejan lo real             | 🟡     | Este documento; no hay OpenAPI en este repositorio                                   |
| 25    | No se eliminaron funcionalidades                     | ✅     | Suite completa: 577 pruebas en verde                                                 |
| 26    | No se introdujeron secretos                          | ✅     | Ningún archivo nuevo contiene credenciales                                           |
| 27    | Nada se declara funcionando sin evidencia            | ✅     | §6                                                                                   |
| §11.1 | Ver versión actual por ambiente                      | ✅     | `EnvironmentHeadsPanel.tsx`                                                          |
| §11.1 | Diferencias entre versiones (diff)                   | ❌     | **No implementado.** Ver §4                                                          |
| §11.4 | Acciones administrativas sólo visibles al autorizado | ✅     | `decision-policy.ts`                                                                 |
| §11.5 | Confirmación antes de una acción crítica             | ✅     | `DecisionConfirmDialog.tsx`                                                          |
| §15.4 | Manejo de 409 y reintentos seguros                   | ✅     | `useApprovalDecision.ts` + prueba de 409                                             |

## 4. Lo que NO se implementó, y por qué

**Detección y resolución de conflictos (§6 completo, §11.3).** No existe en el
backend: no hay endpoint, ni estado `CONFLICTED`, ni tipo de conflicto, ni ruta
de resolución. Implementarlo sólo en el portal significaría comparar dos grafos
en el cliente y ofrecer resoluciones que **ningún endpoint puede aceptar**: un
formulario que no envía nada. Sería exactamente el «botón oculto confundido con
autorización real» que el propio prompt prohíbe, en versión inversa.

Para hacerlo bien hace falta, en el backend: un modelo de solicitud con
`baseVersionId`, un comparador estructural por identificadores estables
(`nodes.<id>.condition`, `edges.<id>.targetNodeId`…), persistencia de conflictos
y resoluciones, y un merge transaccional. Después de eso, el portal es trabajo
de un par de días.

**Diff estructural entre versiones (§11.1).** Depende del mismo comparador. La
pantalla ahora **dice que no lo calcula** y remite al grafo y al checksum, en vez
del bloque decorativo anterior que sugería que sí había una comparación.

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
node scripts/verify-source.mjs       → passed (529 archivos)
node scripts/verify-conventions.mjs  → passed
npx tsc --noEmit                     → sin errores
npx vitest run                       → 77 archivos · 577 pruebas · todas en verde
```

**No ejecutado, y por qué:**

- `yarn build` y `yarn test:e2e:prod` — **otro agente está trabajando en el
  repositorio en este momento** (`e2e/graph-panels-overflow.spec.ts`,
  `src/styles/parts/graph-actions.css`). `next build` reescribe `.next` y dejaría
  su servidor de desarrollo sirviendo módulos que ya no existen (CLAUDE.md lo
  advierte). Debe correrse cuando el repositorio esté libre.
- `yarn` como tal falla en esta máquina: Node 24.18.1 contra el motor declarado
  `>=20.9 <24`. Por eso los comandos se ejecutaron con `npx`. Es un desajuste del
  entorno local, no del cambio.
- Cualquier prueba de concurrencia, idempotencia real o constraint de base de
  datos: necesitan el backend.

## 7. Riesgos pendientes

1. **La invariante de producción sigue sin verificarse.** El portal la muestra;
   nadie ha comprobado que la base la imponga. Es el riesgo número uno.
2. **La idempotencia depende del backend.** Si ignora `Idempotency-Key`, el
   reintento duplica igual.
3. **No hay conflictos ni diff.** Dos personas editando el mismo grafo siguen
   pisándose sin que nadie lo detecte.
4. **`hasAnyRole` concede todo a `PLATFORM_ADMIN`.** Es la convención del
   repositorio, pero significa que un administrador de plataforma ve habilitado
   un paso de `COMPLIANCE`. El backend decide; si allí no lo es, verá un 403.
5. **Las claves donde el backend cuelga los gates son una conjetura**
   (`gates`, `qualityGates`, `checks`, `validations`, `evidence`). Si usa otro
   nombre, la pantalla mostrará «sin datos» — que es el fallo seguro correcto,
   pero conviene confirmar el nombre real y fijarlo.
