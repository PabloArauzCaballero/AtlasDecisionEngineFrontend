# Credenciales y accesos — SOLO DESARROLLO

> **Este documento no vale para producción, y no es una recomendación de que exista
> un equivalente para producción.** Todo lo de aquí describe el entorno local que
> levanta `docker compose`: contraseñas de juguete, claves generadas para la
> máquina de quien desarrolla y usuarios sembrados. En producción cada uno de
> estos valores lo entrega el gestor de secretos de la plataforma y **nunca** un
> archivo del repositorio.

## Por qué aquí no hay contraseñas escritas

Este proyecto ya tuvo un incidente por esto. `AtlasBackend/docs/database/dev-credentials.md`
documenta **ATLAS-P0-002**: la contraseña del administrador estuvo en texto plano
en un archivo versionado, hubo que **rotarla** y retirarla, con esta conclusión
apuntada allí mismo:

> «Un hash o contraseña que aparece en el historial de git se considera
> comprometido permanentemente, sin importar qué tan fuerte sea.»

Lo importante es _permanentemente_: borrar el archivo después no sirve, porque el
valor queda en el historial para siempre y cualquiera con acceso al repositorio
—hoy o dentro de tres años— lo recupera con un `git log`. Por eso este documento
dice **dónde está y cómo se lee** cada credencial, no cuál es. Se tarda lo mismo
en usarlo y no repite el incidente.

Los `.env` de los tres repositorios están en `.gitignore` y **deben seguir
estándolo**.

---

## Mapa rápido de servicios

| Servicio                | URL local                  | Repositorio                   |
| ----------------------- | -------------------------- | ----------------------------- |
| Portal (interfaz)       | http://localhost:5180      | `AtlasDecisionEngineFrontend` |
| Motor de decisión (API) | http://127.0.0.1:3000      | `AtlasDecisionEngine`         |
| Documentación OpenAPI   | http://127.0.0.1:3000/docs | `AtlasDecisionEngine`         |
| PostgreSQL del motor    | `127.0.0.1:55432`          | `AtlasDecisionEngine`         |
| Proveedor de identidad  | ver `API_PUBLISH_PORT`     | `AtlasBackend`                |

`127.0.0.1` y no `localhost` a propósito: en Windows, `localhost` resuelve primero
por IPv6 y el motor escucha en IPv4, así que `localhost:3000` puede fallar sin
motivo aparente.

---

## Entrar al portal

El portal no tiene usuarios propios: la sesión la emite el proveedor de identidad
(`AtlasBackend`). El usuario administrador local lo siembra
`development/20260704121500-seed-pablo-admin-user`, que **falla a propósito si
`NODE_ENV=production`**.

| Campo          | Valor                                          |
| -------------- | ---------------------------------------------- |
| Email          | `pablo@atlas.internal`                         |
| Contraseña     | No versionada — la tiene el dueño de la cuenta |
| Rol en la base | `admin`                                        |
| Tenant         | `1`                                            |

El seeder describe esta cuenta con `SUPER_ADMIN`, `SYSTEMS_ADMIN` y
`DATA_GOVERNANCE_MANAGER`, pero lo que hay grabado en `iam.internal_users` es
`role_code = 'admin'`. Manda la base, no el comentario del seeder.

Para rotarla: genera el hash con `hashPassword()`
(`AtlasBackend/src/common/utils/crypto/password.util.ts`) y actualiza el seeder.
**Nunca** escribas la contraseña en claro en un archivo versionado.

### Las demás cuentas sembradas NO pueden iniciar sesión

Conviene saberlo antes de intentarlo. La contraseña no vive en la ficha del
usuario sino en `iam.auth_credentials`, y **sólo una cuenta tiene fila ahí**. Las
demás existen como fichas de directorio —para que las pantallas tengan a quién
mostrar y a quién atribuir acciones— y no como accesos. Intentar entrar con ellas
falla, y no es un fallo de configuración.

Comprobado contra la base en marcha:

| Usuario                     | Tabla                | Rol                    | ¿Entra? |
| --------------------------- | -------------------- | ---------------------- | ------- |
| `pablo@atlas.internal`      | `iam.internal_users` | `admin`                | **Sí**  |
| `risk.ops@atlas.test`       | `iam.internal_users` | `risk_analyst`         | No      |
| `pablo.platform@atlas.test` | `iam.platform_users` | `platform_super_admin` | No      |

Puedes verificarlo tú mismo en cualquier momento:

```bash
cd AtlasBackend
docker compose exec -T postgres psql -U atlas -d atlas -c "
  SELECT u.email, u.role_code,
         CASE WHEN c.password_hash IS NULL THEN 'sin credencial' ELSE 'puede entrar' END AS acceso
  FROM iam.internal_users u
  LEFT JOIN iam.auth_credentials c
    ON c.actor_id = u._id AND c.actor_type = 'internal_user' AND c._deleted = false
  WHERE u._deleted = false;"
```

> El seeder `20260626160720-seed-minimal-dev-credentials` declara además
> `pablo.admin@atlas.test`, pero **no está en la base**: quedó desplazado por el
> seeder posterior. Si lo buscas y no aparece, no es un error tuyo.

Así que **para la demostración hay una sola cuenta**. Si necesitas enseñar la
vista de un rol concreto —qué ve un auditor, qué le falta a un analista— tienes
dos caminos:

1. **Cambiar el rol de la cuenta que sí entra.** Reversible y sin tocar código:

   ```bash
   cd AtlasBackend
   docker compose exec -T postgres psql -U atlas -d atlas -c      "UPDATE iam.internal_users SET role_code = 'AUDITOR_READONLY' WHERE email = 'pablo@atlas.internal';"
   ```

   Devuélvelo a `admin` con el mismo comando al terminar. Cierra y abre sesión
   para que el cambio surta efecto.

2. **Dar credencial a otra ficha**: genera el hash con `hashPassword()`
   (`AtlasBackend/src/common/utils/crypto/password.util.ts`) e insértalo en
   `iam.auth_credentials` con un `INSERT` — nunca en el seeder versionado, por lo
   dicho al principio.

### Los 20 roles internos disponibles

Definidos en `AtlasBackend/src/modules/internal-users/internal-rbac.permissions.ts`,
cada uno con su lista de permisos:

`SUPER_ADMIN` · `SYSTEMS_ADMIN` · `INTERNAL_IDENTITY_ADMIN` · `OPERATIONS_MANAGER`
· `OPERATIONS_ANALYST` · `RISK_MANAGER` · `RISK_ANALYST` · `FRAUD_ANALYST`
· `COMPLIANCE_MANAGER` · `COMPLIANCE_ANALYST` · `COLLECTIONS_MANAGER`
· `COLLECTIONS_AGENT` · `FINANCE_MANAGER` · `MERCHANT_OPERATIONS`
· `DATA_GOVERNANCE_MANAGER` · `DATA_QUALITY_ANALYST` · `QA_ENGINEER`
· `AUDITOR_READONLY` · `SUPPORT_AGENT` · `EXECUTIVE_READONLY`

Ojo con dos catálogos que se parecen y no son lo mismo: éstos son los roles del
**proveedor de identidad**, que gobiernan qué pantallas del portal se ven. Los de
la **clave de API del motor** (`RISK_ANALYST`, `AUDITOR`, `PLATFORM_ADMIN`…)
gobiernan qué endpoints acepta el motor. Comparten algunos nombres.

### Si el portal dice «tu usuario no tiene ningún rol habilitado»

Ese mensaje engaña: casi siempre el usuario **sí** tiene roles y lo que falla es
el origen. `CORS_ALLOWED_ORIGINS` del motor gobierna también las rutas de sesión,
así que si el portal se sirve en un puerto que no está en esa lista, el motor
responde `403 UNTRUSTED_ORIGIN` y el portal lo traduce a «sin roles». Comprueba
que el puerto del portal esté incluido:

```bash
grep CORS_ALLOWED_ORIGINS AtlasDecisionEngine/.env
```

---

## Claves de API del motor

Dos claves con audiencias distintas, ambas en `AtlasDecisionEngine/.env`:

| Variable             | Para qué sirve                                                           | Cabecera    |
| -------------------- | ------------------------------------------------------------------------ | ----------- |
| `MANAGEMENT_API_KEY` | Gestión: catálogos, artefactos, simulaciones, pruebas, campos calculados | `x-api-key` |
| `RUNTIME_API_KEY`    | Ejecutar decisiones de verdad (`POST /v1/decisions/...`)                 | `x-api-key` |

Toda petición lleva además `x-tenant-id: 1`.

**Cómo leerlas** (no se copian aquí):

```bash
cd AtlasDecisionEngine
grep -E '^(MANAGEMENT|RUNTIME)_API_KEY=' .env
```

Ejemplo de uso, tomando la clave del `.env` sin imprimirla en pantalla:

```bash
KEY=$(grep -E '^MANAGEMENT_API_KEY=' .env | cut -d= -f2-)
curl -s -H "x-api-key: $KEY" -H "x-tenant-id: 1" \
  http://127.0.0.1:3000/v1/artifacts | head -c 300
```

Roles que la clave de gestión trae sembrados: `AUDITOR`, `COMPLIANCE`,
`FRAUD_ANALYST`, `OPERATIONS`, `PLATFORM_ADMIN`, `QA_ANALYST`, `RISK_ANALYST`,
`RISK_APPROVER`. La de runtime, sólo `DECISION_RUNTIME`.

---

## Base de datos del motor

Dos usuarios, y la diferencia importa:

| Usuario     | Contraseña en       | Para qué                               |
| ----------- | ------------------- | -------------------------------------- |
| `atlas`     | `POSTGRES_PASSWORD` | Migraciones y siembra. Es superusuario |
| `atlas_app` | `APP_DB_PASSWORD`   | Con el que se conecta la API en marcha |

La API **no debe** conectarse como `atlas`: la seguridad por fila (RLS, migración
`20260719080000_tenant_rls_and_app_role`) es inerte para un superusuario, así que
usarlo dejaría a cada tenant viendo los datos de los demás sin que nada falle ni
avise.

Consola de SQL sin exponer la contraseña:

```bash
cd AtlasDecisionEngine
docker compose exec -T postgres psql -U atlas -d atlas_decision -c "SELECT count(*) FROM decision_artifact;"
```

---

## Datos sembrados para la demostración

| Dato                | Valor                                                  |
| ------------------- | ------------------------------------------------------ |
| Tenant              | `1`                                                    |
| Ambientes           | `SANDBOX` (1), `PROD` (2), `TEST` (3)                  |
| Algoritmo principal | `BNPL_CREDIT_DECISION` · v2.3.0 · desplegado           |
| Segundo algoritmo   | `COLLECTIONS_PRIORITIZATION` · v1.0.0 · activo en TEST |
| Demo de contratos   | `AFFORDABILITY_CONTRACT_DEMO` · v1.2.0                 |
| Suite de regresión  | `BNPL_ORIGINATION_REGRESSION` · 21 casos               |
| Campos calculados   | 6 (constructor visual, JavaScript y Python)            |

La siembra es idempotente y **se salta si la versión ya existe**: para que un
cambio en los seeders llegue hay que subir la versión semántica del artefacto.

```bash
cd AtlasDecisionEngine
docker compose run --rm seed
```

---

## Comprobar que todo responde

```bash
cd AtlasDecisionEngine
bash ./scripts/smoke.sh     # 5 comprobaciones de punta a punta
curl -s -o /dev/null -w "motor %{http_code}\n" http://127.0.0.1:3000/health
curl -s -o /dev/null -w "portal %{http_code}\n" http://localhost:5180/login
```

---

## Qué cambia en producción

Nada de lo anterior se traslada. En concreto:

- Las claves de API las emite y rota el gestor de secretos; no viven en ningún `.env`.
- El usuario sembrado **no existe**: su seeder aborta con `NODE_ENV=production`.
- `SEED_INCLUDE_MOCKUP` va en `false`: nada de datos de demostración.
- `SCRIPT_RUNNER_MODE=SIDECAR` es obligatorio, y el sidecar corre bajo gVisor
  (`runtime: runsc`): `runc` a secas comparte el núcleo con el anfitrión y no es
  una frontera de seguridad para ejecutar código de terceros.
