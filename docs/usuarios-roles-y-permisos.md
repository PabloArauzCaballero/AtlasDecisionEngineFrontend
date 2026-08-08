# Usuarios, roles y permisos (por qué "no me deja")

Muchos botones que parecen "rotos" en realidad **requieren un rol** que tu usuario
no tiene. El portal inicia sesión contra el **Identity Provider (IdP, servicio
aparte en `:3005`)** — los usuarios y sus roles **viven ahí, no en la base del
Decision Engine** (su esquema no tiene tabla de usuarios). Por eso no se pueden
"sembrar" usuarios desde el backend del motor: hay que crearlos en el IdP.

## Las tres reglas de negocio del ciclo de vida de un artefacto

Viven en `src/auth/business-rules.ts`, en un solo lugar y con pruebas
(`business-rules.test.ts`). El vocabulario del encargo se traduce a los roles que
el IdP emite de verdad: no se inventaron roles nuevos, porque un rol que nadie
emite deja la regla apagada sin avisar.

| Encargo            | Rol real         |
| ------------------ | ---------------- |
| admin              | `PLATFORM_ADMIN` |
| tester             | `QA_ANALYST`     |
| analista de riesgo | `RISK_ANALYST`   |

### 1 · Sólo el admin crea artefactos

Dar de alta un artefacto abre una familia de versiones nueva, y esa decisión no
la toma nadie más. El resto de roles con acceso a la ruta consulta el inventario
y propone cambios sobre lo que ya existe.

El mecanismo es `createRoles` en `src/resources/resource.config.ts`: un recurso
puede consultarse con el permiso de la ruta y darse de alta con uno más estrecho.
Se usa también en el catálogo de variables y de reason codes, porque **declarar
una variable es autoría** —define un dato que las decisiones van a usar— y
consultarla no. Sin `createRoles`, alta y lectura son lo mismo, que es el caso
normal.

### 2 · El tester propone cambios; a producción publica el admin

**No hay ramas ni merge en el backend** — hay versiones inmutables y despliegues
por ambiente (`docs/auditoria-versionado-2026-08-03.md` §1). El vocabulario de
git se traduce así:

| Encargo            | Sistema real                                                  |
| ------------------ | ------------------------------------------------------------- |
| Pull request       | Crear una versión y enviarla a revisión (`submit-for-review`) |
| Mergear a **dev**  | Promover a un ambiente NO productivo (`SANDBOX`, `TEST`)      |
| Mergear a **main** | Promover a un ambiente con `isProduction` (`PROD`)            |

El tester (`QA_ANALYST`) y el analista de fraude (`FRAUD_ANALYST`) crean
versiones, las prueban, las compilan, las envían a revisión y las promueven a un
ambiente de trabajo. **Promover a producción exige `PLATFORM_ADMIN`**: el
selector de ambiente sólo lista los destinos permitidos y la comprobación se
repite antes de enviar, porque el catálogo degrada a texto libre cuando no carga
y ahí alguien podría escribir `PROD` a mano
(`src/features/deployments/promotion-targets.ts`).

Un ambiente del que no se sabe si es productivo **se trata como productivo**:
fallar hacia el lado seguro es pedir un administrador de más, no dejar pasar un
despliegue a clientes.

### 3 · El analista de riesgo consulta; no programa

`RISK_ANALYST` **no aparece en ninguna política de autoría** — grafo, acciones,
importación de código, campos calculados, suites, QA Lab, simulador — porque no
es programador y una regla de decisión es exactamente lo que no debe poder
tocar. Lo que sí puede:

- Leer el catálogo, los artefactos, las versiones, los ambientes, las
  ejecuciones, la cobertura y la auditoría.
- **Abrir el expediente completo de un caso** de revisión manual: quién es el
  solicitante, con qué datos se decidió, qué motivos se emitieron y cuál fue la
  salida (`src/features/manual-review/CaseFilePanel.tsx`). El caso trae la cola y
  el motivo; la ejecución entera se pide aparte a `/v1/audit/executions/{id}`, y
  si no está disponible la pantalla lo dice en vez de aparentar un expediente
  completo.
- **Solicitar más información**: al backend central, al cliente o a un equipo
  interno (`CaseInformationRequestDialog.tsx`). No cambia ninguna regla ni
  resuelve el caso: deja constancia de qué dato falta y a quién se le pide.
- Resolver el caso de revisión manual, que sigue siendo su función operativa
  documentada. Es una decisión sobre **un caso concreto**, no sobre la regla que
  lo derivó.

Lo que sí perdió, y conviene no confundir con lo anterior: **fijar objetivos de
negocio** (`/objectives`). Los consulta y ve su matriz de cobertura, pero no los
crea — un objetivo es la vara con la que se juzga si un algoritmo cumple, y eso
es gobierno. Decidir un expediente concreto y fijar el criterio con que se miden
todos son cosas distintas; `business-rules.test.ts` fija las dos por separado
para que un descuido no se lleve por delante la cola de revisión manual.

> **Contrato pendiente del backend.** `POST /v1/manual-reviews/{id}/information-requests`
> está acordado pero puede no estar desplegado. El portal distingue el 404 de
> «el caso no existe» y explica que falta el endpoint
> (`information-request.ts`), en vez de mostrar un «no encontrado» crudo.
> La especificación completa —cuerpo, respuesta, errores y autorización— está en
> [contrato-pendiente-peticion-de-informacion.md](contrato-pendiente-peticion-de-informacion.md).

## Qué rol necesita cada acción

| Acción                                      | Rol requerido                                 |
| ------------------------------------------- | --------------------------------------------- |
| **Crear un artefacto**                      | `PLATFORM_ADMIN`                              |
| Declarar una variable o un reason code      | `QA_ANALYST`, `FRAUD_ANALYST`                 |
| **Promover a producción** / rollback        | `PLATFORM_ADMIN`                              |
| **Promover a un ambiente de trabajo**       | `QA_ANALYST`, `FRAUD_ANALYST`                 |
| Autoría de grafo, acciones, campos calc.    | `QA_ANALYST`, `FRAUD_ANALYST`                 |
| Importar código a flujo                     | `QA_ANALYST`, `FRAUD_ANALYST`                 |
| Crear/ejecutar suites, QA Lab, simulador    | `QA_ANALYST`, `FRAUD_ANALYST`                 |
| Enviar una versión a revisión               | `QA_ANALYST`, `FRAUD_ANALYST`                 |
| Firmar un paso de aprobación                | El `requiredRole` que declara el propio paso  |
| Resolver casos de **revisión manual**       | `RISK_ANALYST`, `FRAUD_ANALYST`, `OPERATIONS` |
| Fijar objetivos de negocio                  | `COMPLIANCE`                                  |
| **Expediente del caso / pedir información** | `RISK_ANALYST`, `FRAUD_ANALYST`, `OPERATIONS` |
| Consultar catálogo, artefactos, ambientes   | `RISK_ANALYST` y el resto de roles de lectura |
| Auditoría / seguridad                       | `AUDITOR`, `COMPLIANCE`                       |

> Nota de separación de funciones: **el autor de una versión no puede desplegarla**
> él mismo. Necesitas un segundo usuario con `PLATFORM_ADMIN` distinto del autor.

> Nota sobre `PLATFORM_ADMIN`: `hasAnyRole` se lo concede todo por convención del
> repositorio, así que un administrador ve habilitada cualquier acción. El
> backend decide; si allí no lo es, verá un 403.

## Lo que el portal NO garantiza

Ocultar o deshabilitar un botón **no es un control de acceso**. Todo lo anterior
es la mitad cliente del contrato: evita ofrecer una acción que va a terminar en
403 sin explicar por qué, y nada más. **El backend revalida cada POST con sus
propios `@Roles`**, y es ahí donde estas reglas tienen que existir también. Si el
motor no las impone, un cliente HTTP directo las salta enteras.

## Cómo crear los usuarios de risk y de revisión manual

Se crean **en el IdP** (no en el motor). Según tu despliegue del IdP:

1. **Panel/API del IdP** (`:3005`): crea los usuarios y asígnales los roles:
   - Usuario de riesgo → `RISK_ANALYST` (consulta y casos).
   - Tester → `QA_ANALYST` (propone versiones y promueve a ambientes de trabajo).
   - Administrador → `PLATFORM_ADMIN` (crea artefactos y publica en producción;
     distinto del autor de la versión).
2. Inicia sesión en el portal con cada uno; el portal lee los roles del token de
   sesión y habilita los botones correspondientes.

## Atajo para pruebas por API (sin IdP)

La **MANAGEMENT_API_KEY** de bootstrap ya trae **todos** los roles de gestión
(`BOOTSTRAP_MANAGEMENT_ROLES`, por defecto todos), así que los scripts de `docs/`
(que usan `x-api-key`) pueden crear variables, artefactos, referencias y suites sin
depender del IdP. Eso cubre las pruebas automatizadas; para usar el **portal** con
distintos roles, sí necesitas los usuarios en el IdP.
