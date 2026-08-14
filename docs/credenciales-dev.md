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

| Campo          | Valor                                                           |
| -------------- | --------------------------------------------------------------- |
| Email          | El buzón real del dueño (ver abajo; era `pablo@atlas.internal`) |
| Contraseña     | No versionada — la tiene el dueño de la cuenta                  |
| Rol en la base | `admin`                                                         |
| Tenant         | `1`                                                             |

El seeder sigue creando la cuenta con `pablo@atlas.internal`, pero en la base de
esta máquina el correo se cambió por uno real: con el segundo factor encendido, el
PIN va a esa dirección y `.internal` no tiene buzón. Consúltalo cuando lo
necesites, no lo supongas:

```bash
cd AtlasBackend
docker compose exec -T postgres psql -U atlas -d atlas -c \
  "SELECT _id, email, role_code FROM iam.internal_users WHERE _id = 1;"
```

El seeder describe esta cuenta con `SUPER_ADMIN`, `SYSTEMS_ADMIN` y
`DATA_GOVERNANCE_MANAGER`, pero lo que hay grabado en `iam.internal_users` es
`role_code = 'admin'`. Manda la base, no el comentario del seeder.

Para rotarla: genera el hash con `hashPassword()`
(`AtlasBackend/src/common/utils/crypto/password.util.ts`) y actualiza el seeder.
**Nunca** escribas la contraseña en claro en un archivo versionado.

### El segundo factor: cómo se enciende y cómo se apaga

Para un actor INTERNO el 2FA no es una preferencia de la cuenta: es obligatorio
en cuanto el proveedor tiene por dónde entregar el PIN, y desaparece —en
silencio— si no lo tiene. Eso lo decide la configuración del despliegue, no la
columna `iam.internal_users.mfa_enabled`, que **no la escribe ningún camino de
código**.

Encenderlo en local exige dos cosas, y la segunda es la que muerde:

1. **Un canal de correo que llegue al contenedor.** `docker-compose.yml` no tiene
   `env_file`, así que sólo llega lo que está escrito en `x-atlas-env`; ahí se
   pasan ya `NOTIFICATION_EMAIL_PROVIDER`, las cuatro `GMAIL_*`, las
   `MAILSENDER_*` y `AUTH_LOGIN_PIN_ENABLED`, tomadas del `.env` de la máquina.
   Con el `.env` configurado basta con reconstruir el contenedor.

2. **Un correo que puedas LEER en la ficha del usuario.** El PIN se manda a
   `iam.internal_users.email`. El usuario sembrado trae `pablo@atlas.internal`, un
   TLD reservado sin buzón: con el canal encendido y ese correo, nadie puede
   entrar. Cámbialo antes de reiniciar:

   ```bash
   cd AtlasBackend
   docker compose exec -T postgres psql -U atlas -d atlas -c \
     "UPDATE iam.internal_users SET email='<tu-correo-real>', _updated_at=now()
      WHERE email='pablo@atlas.internal' AND _deleted = false;"
   docker compose --profile app up -d --build api worker
   ```

**Apagarlo** —si te quedas fuera, o para una demostración sin correo— es una
variable y un reinicio:

```bash
echo "AUTH_LOGIN_PIN_ENABLED=false" >> AtlasBackend/.env
cd AtlasBackend && docker compose --profile app up -d api worker
```

En producción esa combinación no arranca a propósito (`env-cross-checks.ts`):
un despliegue que renuncia al segundo factor interno tiene que escribirlo, y aun
así se le exige un canal de correo, porque el mismo canal entrega el reset de
contraseña. El canal por `webhook` **no** cuenta como canal de producción: es la
forma que tiene el recolector de las pruebas, y admitirlo allí permitiría
desviar los segundos factores de todo un despliegue a un buzón cualquiera.

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
| Ambientes           | `DEV` (1), `PROD` (2), `TEST` (3) y `STAGING`          |
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

## Detalles de la interfaz que conviene saber

- **La X de la barra lateral sólo aparece en pantallas estrechas** (bajo 820 px),
  porque sólo ahí la barra es un cajón que se pueda cerrar. En escritorio es
  permanente. Antes se pintaba también en escritorio por un empate de
  especificidad en el CSS, y pulsarla no hacía nada.
- **Los diálogos se montan en `document.body`**, no donde se declaran.
  `position: fixed` se posiciona respecto a la pantalla salvo que un ancestro
  tenga `transform`, y la animación de entrada de cada ruta deja uno fijado: sin
  el portal, los modales se centraban respecto al documento y salían abajo y
  cortados.
- **Las superficies de trabajo no llevan fondo ambiental** (editor, calidad,
  despliegues, ejecuciones). Se conserva en el panel principal y en el acceso.

## Una cuenta para las pruebas contra el motor real

Las especificaciones `e2e/portal-real-*.spec.ts` entran por la pantalla de
acceso, así que necesitan una cuenta que **pueda iniciar sesión de verdad**.
Usar la del dueño del entorno obliga a compartir su contraseña; en su lugar se
provisiona una cuenta de desarrollo con el rol MÍNIMO que la vista bajo prueba
exige, que además hace que la corrida compruebe los `@Roles` del motor en vez de
saltárselos con un administrador.

`risk.ops@atlas.test` ya existe en el directorio como ficha sin credencial. Se le
da una así —**la contraseña se genera en el momento y no se escribe en ningún
archivo versionado**—:

```bash
cd AtlasBackend
# 1. Una contraseña nueva, sólo para este entorno.
PASS=$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")

# 2. Su hash Argon2id, con los mismos parámetros que usa el backend.
HASH=$(docker compose exec -T -e P="$PASS" api node -e \
  "const a=require('argon2');a.hash(process.env.P,{type:a.argon2id,memoryCost:19456,timeCost:2,parallelism:1}).then(h=>console.log(h))")

# 3. La credencial y los roles. `internal_user_roles` es lo que llena el array
#    `roles` de la sesión: sin filas ahí, la cuenta entra pero el portal no le
#    enseña ninguna sección, que parece un fallo del portal y no lo es.
docker compose exec -T postgres psql -U atlas -d atlas -c "
  INSERT INTO iam.auth_credentials (_tenant_id, actor_type, actor_id, password_hash,
         token_version, failed_login_attempts, _created_at, _updated_at, _deleted, mfa_enabled)
  VALUES (1, 'internal_user', 2, '$HASH', 1, 0, now(), now(), false, false)
  ON CONFLICT DO NOTHING;
  INSERT INTO iam.internal_user_roles (_tenant_id, internal_user_id, role_id, assigned_at, _created_at, _updated_at)
  SELECT 1, 2, r._id, now(), now(), now() FROM iam.internal_roles r
  WHERE r.role_code IN ('RISK_ANALYST','FRAUD_ANALYST') AND r._deleted = false
    AND NOT EXISTS (SELECT 1 FROM iam.internal_user_roles ur
                    WHERE ur.internal_user_id = 2 AND ur.role_id = r._id AND ur.revoked_at IS NULL);"

echo "$PASS"   # cópiala al .env.e2e del portal y bórrala de la terminal
```

En el portal, `AtlasDecisionEngineFrontend/.env.e2e` —**ignorado por git**—:

```dotenv
PW_BASE_URL=http://localhost:5180
PW_TENANT_ID=1
PW_USER=risk.ops@atlas.test
PW_PASSWORD=<la que imprimió el paso anterior>
# Sólo si el proveedor exige segundo factor: puerto del recolector de correo que
# levanta la propia batería para leer el PIN (ver CLAUDE.md).
PW_PIN_INBOX_PORT=5199
```

Con el segundo factor encendido, esta cuenta **también** recibe PIN, y su correo
(`risk.ops@atlas.test`) tampoco es un buzón real. Por eso la batería no lee un
buzón sino el recolector: se apunta el canal del proveedor al webhook
(`NOTIFICATION_EMAIL_PROVIDER=webhook`,
`NOTIFICATION_EMAIL_WEBHOOK_URL=http://host.docker.internal:5199/correo`) y el
PIN se lee por donde de verdad salió. La alternativa —apagar el 2FA mientras
corren las pruebas— deja la corrida en verde sin haber probado el acceso real.

Para deshacerlo: `UPDATE iam.auth_credentials SET _deleted = true WHERE
actor_type = 'internal_user' AND actor_id = 2;` y `UPDATE iam.internal_user_roles
SET revoked_at = now() WHERE internal_user_id = 2;`.

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
