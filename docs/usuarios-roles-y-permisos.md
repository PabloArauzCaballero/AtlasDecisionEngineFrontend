# Usuarios, roles y permisos (por qué "no me deja")

Muchos botones que parecen "rotos" en realidad **requieren un rol** que tu usuario
no tiene. El portal inicia sesión contra el **Identity Provider (IdP, servicio
aparte en `:3005`)** — los usuarios y sus roles **viven ahí, no en la base del
Decision Engine** (su esquema no tiene tabla de usuarios). Por eso no se pueden
"sembrar" usuarios desde el backend del motor: hay que crearlos en el IdP.

## Qué rol necesita cada acción

| Acción                                            | Rol requerido                                             |
| ------------------------------------------------- | --------------------------------------------------------- |
| Desplegar una versión / rollback                  | `PLATFORM_ADMIN`                                          |
| Resolver casos de **revisión manual**             | `RISK_ANALYST` o `FRAUD_ANALYST`                          |
| Autoría de grafo y **referenciar otro algoritmo** | `RISK_ANALYST` / `FRAUD_ANALYST`                          |
| Crear/ejecutar **suites de prueba**               | `QA_ANALYST` (o RISK/FRAUD)                               |
| Importar código a flujo                           | `RISK_ANALYST` / `FRAUD_ANALYST`                          |
| Ver ambientes                                     | `PLATFORM_ADMIN`, `RISK_ANALYST`, `QA_ANALYST`, `AUDITOR` |
| Auditoría / seguridad                             | `AUDITOR`, `COMPLIANCE`                                   |

> Nota de separación de funciones: **el autor de una versión no puede desplegarla**
> él mismo. Necesitas un segundo usuario con `PLATFORM_ADMIN` distinto del autor.

## Cómo crear los usuarios de risk y de revisión manual

Se crean **en el IdP** (no en el motor). Según tu despliegue del IdP:

1. **Panel/API del IdP** (`:3005`): crea dos usuarios y asígnales los roles:
   - Usuario de riesgo → `RISK_ANALYST` (+ `FRAUD_ANALYST` si aplica).
   - Usuario de revisión manual → `RISK_ANALYST` o `FRAUD_ANALYST`.
   - Un tercero → `PLATFORM_ADMIN` para poder desplegar (distinto del autor).
2. Inicia sesión en el portal con cada uno; el portal lee los roles del token de
   sesión y habilita los botones correspondientes.

## Atajo para pruebas por API (sin IdP)

La **MANAGEMENT_API_KEY** de bootstrap ya trae **todos** los roles de gestión
(`BOOTSTRAP_MANAGEMENT_ROLES`, por defecto todos), así que los scripts de `docs/`
(que usan `x-api-key`) pueden crear variables, artefactos, referencias y suites sin
depender del IdP. Eso cubre las pruebas automatizadas; para usar el **portal** con
distintos roles, sí necesitas los usuarios en el IdP.
