# Auditoría integral — Portal + Motor (13 de agosto de 2026)

Auditoría ejecutada, no leída: cada afirmación de este documento sale de correr la
puerta correspondiente o de una petición real contra el servicio en marcha. Donde
sólo hay lectura de código, se dice.

- **Portal** `AtlasDecisionEngineFrontend` — rama `dev`, HEAD `dd7d66c`.
- **Motor** `AtlasDecisionEngine` — rama `test/workers-integracion-postgres`, HEAD `f5923c7`.

---

## 1. Resumen ejecutivo

La ingeniería de estos dos repositorios está muy por encima de la media: puertas
propias que verifican invariantes que ningún linter conoce (superficie del motor
consumida, tokens de diseño resueltos, rutas con regla de acceso, RLS por tabla),
1.092 pruebas unitarias en el portal, 185 ficheros de especificación en el motor,
30 módulos, 13 ADR, 241 documentos, contenedores sin root, CSP con nonce por
petición, guardia de autenticación global por `APP_GUARD`.

Y hoy, **ocho puertas están en rojo (dos en el portal, seis en el motor), tres
vulnerabilidades ALTAS bloquean la CI del motor, un servicio del motor está
publicado sin autenticación en todas las interfaces, y 25.000 líneas de trabajo
llevan ocho días sin salir de este disco.**

Lo que sí está en verde importa para leer bien lo anterior: el portal pasa lint,
tipos, build y sus 1.092 pruebas; el motor pasa lint, tipos y sus 1.559 pruebas en
164 suites, con sólo 2 saltadas. **El código funciona. Lo que falla es el cierre:
el perímetro, la entrega y la sincronía entre lo que el sistema hace y lo que sus
puertas y su documentación afirman que hace.**

La distancia entre la calidad del diseño y el estado de la entrega es el hallazgo
principal. No es un problema de capacidad técnica; es un problema de cierre.

**Calificación global: 6,9 / 10.**

---

## 2. Estado medido de las puertas

### 2.1 Portal

| Puerta               | Comando                           | Resultado                                                       |
| -------------------- | --------------------------------- | --------------------------------------------------------------- |
| `format:check`       | `prettier --check .`              | ❌ `docker-compose.yml`                                         |
| `lint`               | `eslint . --max-warnings=0`       | ✅ limpio                                                       |
| `verify:source`      | `node scripts/verify-source.mjs`  | ❌ `IdentityVerificationWorkerPage.tsx` 301 líneas (límite 299) |
| `typecheck`          | `tsc --noEmit`                    | ✅                                                              |
| `test`               | `vitest run`                      | ✅ 139 ficheros · 1.092 pruebas                                 |
| `build`              | `next build`                      | ✅ sin avisos (compilado a `.next-audit`, ya borrado)           |
| superficie del motor | `node scripts/engine-surface.mjs` | ✅ pero el inventario **no está versionado** (§4.3)             |
| dependencias (altas) | `yarn audit --level high`         | ✅ 0 altas (2 bajas + 2 moderadas)                              |

> **Nota de honestidad**: `verify:source` pasó a las 15:26 y falló a las 15:47.
> `IdentityVerificationWorkerPage.tsx` cambió de tamaño a las 15:30, durante la
> auditoría. Muy probablemente una edición en curso; el hecho es que **en este
> momento la puerta está roja**.

### 2.2 Motor

| Puerta               | Comando                                 | Resultado                                                        |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| `lint`               | `eslint src test`                       | ✅ limpio                                                        |
| `typecheck`          | `tsc --noEmit`                          | ✅                                                               |
| `format:check`       | `prettier --check`                      | ❌ **50 ficheros**                                               |
| `migration:validate` | `python scripts/validate-migrations.py` | ❌ `decision_audio_segment` sin RLS ENABLE reconocido            |
| `security:audit`     | `yarn audit --level high`               | ❌ **3 vulnerabilidades ALTAS**                                  |
| `docs:openapi:check` | script propio                           | ❌ 8 operaciones sin esquema de respuesta                        |
| `docs:vault:check`   | script propio                           | ✅                                                               |
| `docs:coverage`      | script propio                           | ❌ 8 etiquetas, 65 operaciones y 87 variables de entorno fuera   |
| `docs:links`         | script propio                           | ❌ 5 páginas huérfanas                                           |
| `test`               | jest `--runInBand`                      | ✅ 164 suites · 1.559 pruebas · 2 saltadas · **27,9 min** (§5.4) |

Cobertura en disco (última corrida): unitaria 54,6 % líneas / 51,8 % ramas;
combinada con e2e 77,0 % líneas / **56,1 % ramas** / 66,6 % funciones.

---

## 3. Hallazgos P0 — bloqueantes

### P0-1 · El worker de PDF está publicado sin autenticación en todas las interfaces

**Verificado en vivo contra el contenedor en marcha.**

```
GET  http://localhost:3100/pdf/templates   → 200 + catálogo completo, sin credencial
POST http://localhost:3100/pdf/generate    → 422 (validación), NO 401
POST http://localhost:3100/pdf/preview     → 422 (validación), NO 401
GET  http://127.0.0.1:3000/pdf/templates   → 401   ← la MISMA ruta por el motor
```

`docker ps` confirma la exposición: `0.0.0.0:3100->3100/tcp`. El resto del stack
del motor se ata a `127.0.0.1` (api, postgres, redis); **el worker de PDF es el
único que sale a todas las interfaces**.

Causa raíz: `src/pdf-worker.ts` monta `PdfWorkerModule` como proceso suelto y no
registra `SecurityModule`. El único guardia del módulo es `TemplateAdminGuard`, y
sólo cubre `/pdf/admin/*`. Cuando el mismo módulo se importa desde `app.module.ts`
hereda el `APP_GUARD` global y queda protegido — de ahí que la misma ruta responda
401 por el puerto 3000 y 200 por el 3100. **Dos modos de despliegue del mismo
módulo con posturas de seguridad opuestas.**

Agravantes acumulados en el mismo arranque:

- Sin `helmet`, sin `enableCors`, sin `RateLimitGuard` (todos presentes en `main.ts`).
- Límite de cuerpo **8 MiB** sobre un endpoint que dispara Chromium con
  `PDF_RENDER_CONCURRENCY=4`: agotamiento de recursos sin autenticar, trivial.
- Swagger **encendido por omisión en el código** (`PDF_SWAGGER_ENABLED !== 'false'`).
  Hoy está apagado sólo porque `docker-compose.pdf-worker.yml` lo fija; un
  `node dist/pdf-worker.js` a pelo publica `/docs` y `/openapi.json`.
- Catálogo con clasificación `CONFIDENTIAL` legible sin credencial.
- El ADR-0031, que documenta este worker, **no menciona la autenticación**. No hay
  decisión escrita que respalde el estado actual.

Nota de gobierno relacionada: `src/server/decision-engine-proxy.ts` desvía
`pdf/generate` y `pdf/preview` al worker cuando `PDF_WORKER_URL` está definida, así
que esas dos operaciones **no pasan por el interceptor de auditoría de acceso del
motor**. Un documento generado por esa vía no deja la traza que sí deja el resto.

### P0-2 · Tres vulnerabilidades ALTAS en dependencias de producción del motor

| Paquete      | Aviso                                                | Parcheado en | Alcance real en este sistema                                      |
| ------------ | ---------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| `pdfjs-dist` | Ejecución arbitraria de JS al abrir un PDF malicioso | ≥ 6.2.108    | **El worker de extractos parsea PDF subidos por usuarios.**       |
| `sharp`      | CVEs heredadas de libvips (CVE-2026-33327 y otras)   | ≥ 0.35.0     | **El worker de identidad procesa imágenes subidas por usuarios.** |
| `js-yaml`    | Consumo cuadrático de CPU resolviendo `!!omap`       | ≥ 4.3.1      | Transitiva de `@nestjs/swagger`.                                  |

Las dos primeras no son teóricas: hay una ruta directa desde entrada no confiable
hasta la biblioteca vulnerable. `yarn security:audit` está en la CI del motor, así
que además la corrida está bloqueada.

### P0-3 · Ocho días de trabajo sin commitear y sin empujar

| Repo   | Modificados | Sin seguir | Diff                 | Último push a origin |
| ------ | ----------- | ---------- | -------------------- | -------------------- |
| Portal | 234         | **181**    | +5.927 / −3.136      | 5 de agosto          |
| Motor  | 107         | **96**     | **+19.222 / −6.906** | 5 de agosto          |

Dentro de lo que no está en git:

- **El gate completo de superficie del motor**: `scripts/engine-surface.mjs`,
  `engine-surface-paths.mjs`, `engine-surface.test.mjs`, `docs/superficie-motor.json`
  y `docs/superficie-no-consumida.md`. `verify-source.mjs` **sí** está versionado y
  hace `import { verifyEngineSurface } from './engine-surface.mjs'` — en un clon
  limpio ese import revienta antes de ejecutar nada.
- 139 ficheros fuente del portal y 27 especificaciones e2e.
- **Siete migraciones de Prisma** del motor (identidad, clasificación no resuelta,
  locución, ciclo de vida económico, caché de segmentos de audio…).
- Dos ADR (0030, 0031) y el módulo `risk-governance` entero.

Riesgo concreto: un disco. No hay copia en ningún remoto de ocho días de trabajo,
incluido el esquema de base de datos que ya está aplicado en el entorno local.

### P0-4 · La puerta de aislamiento multi-tenant está en rojo

`yarn migration:validate` falla:

```
Tenant tables missing RLS ENABLE: ['decision_audio_segment']
```

**Leído el SQL, la RLS sí está**: la migración `20260813010000_audio_segment_cache`
la activa, la fuerza y crea la política. Lo que ocurre es que la escribe con un
tercer idioma que el validador no conoce:

```sql
DO $$ BEGIN
  EXECUTE 'ALTER TABLE decision_audio_segment ENABLE ROW LEVEL SECURITY';
```

`scripts/validate-migrations.py` reconoce `ALTER TABLE "x" ENABLE ROW LEVEL SECURITY`
(estático) y `ALTER TABLE %I ENABLE ROW LEVEL SECURITY` (dinámico con `format`),
pero no `EXECUTE '…'` con el nombre desnudo.

No es un agujero de aislamiento — es peor de lo que parece por otra razón: **la
tentación de arreglarlo aflojando la expresión regular**. Una regla que acepte
cualquier literal aceptaría también SQL comentado, y entonces la puerta que
protege el aislamiento entre inquilinos deja de proteger nada.

---

## 4. Hallazgos P1 — hay que cerrarlos antes de la próxima entrega

### P1-1 · El `verify` local del motor no reproduce la CI

`package.json` del motor:

```
verify         = lint && typecheck && build && test
verify:release = lint && typecheck && build && test && migration:validate && security:audit
```

**Ninguno de los dos incluye `format:check`**, y la CI sí lo corre. Ésa es la causa
mecánica de que hayan derivado 50 ficheros: la puerta local dice verde y la remota
dice rojo. Tampoco incluyen `docs:validate`, que hoy falla en tres de sus cinco
comprobaciones.

### P1-2 · Documentación del motor desincronizada del código

- **8 operaciones sin esquema de respuesta** (`docs:openapi:check`, límite 0).
- **65 operaciones fuera del catálogo de endpoints** y **8 etiquetas** sin entrada:
  `Outcome Ingestion`, `Risk Governance`, `pdf`, `pdf-templates`, `Workers ·
Categorías semánticas`, `Workers · Locución`, `Workers · Pendientes de
clasificación`, `Workers · Verificación de identidad`.
- **87 variables de entorno sin documentar** (`IDENTITY_PROVIDER_LOGIN_TIMEOUT_MS`,
  `UNRESOLVED_*`, toda la familia `PDF_*`…). Una variable sin documentar es una
  configuración que sólo conoce quien la escribió.
- **5 páginas huérfanas**: ADR-0030, ADR-0031, y los tres documentos de
  `docs/pdf-worker/`. Existen y nadie puede llegar a ellas desde la navegación.

### P1-3 · Controladores sin ninguna prueba

`outcome-ingestion`, `semantic-category`, `pdf-catalog`, `pdf-generation`,
`pdf-template-admin`. El primero importa especialmente: **escribe evidencia
regulatoria** (desenlaces observados que después alimentan el monitoreo del modelo
y las decisiones de gobierno). Cero pruebas en `test/` lo mencionan.

### P1-4 · Cobertura de ramas al 56 %

En un motor de decisión, **las ramas son las decisiones**. 56 % de ramas cubiertas
significa que casi la mitad de los caminos condicionales del sistema no se han
ejecutado nunca en una prueba. El umbral global (49 líneas / 45 ramas) está
declarado explícitamente como «suelo, no objetivo» y eso es honesto, pero un suelo
que no sube es un techo.

### P1-5 · Deuda de superficie: 36 de 197 operaciones sin consumir

El gate está bien y las exenciones están razonadas. Pero dentro de esa lista hay
lagunas de gobierno reales, no ceremonia:

| Operación                                      | Qué significa que no exista                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `POST /v1/deployments/{id}/rollback`           | **Una reversión sólo se puede hacer fuera del portal**, sin registro.                                     |
| `POST /v1/deployments/{id}/suspend`            | Suspender un despliegue tampoco tiene control en la interfaz.                                             |
| `GET /v1/audit/chain/verify`                   | La integridad de la cadena de auditoría sólo se comprueba por consola — justo donde no mira quien audita. |
| `POST /v1/manual-reviews/{id}/assign`          | Un caso se resuelve en el portal pero se asigna fuera.                                                    |
| `GET /v1/security-review/versions/{id}/export` | El informe de revisión de seguridad no tiene botón de exportar.                                           |
| `GET /v1/qa-lab/properties`                    | El catálogo de propiedades está fijado en cliente: una propiedad nueva del motor no aparece sola.         |
| `GET /v1/artifact-versions/{id}/diff/{id}`     | Dos implementaciones del mismo diff (cliente y motor) que pueden discrepar.                               |

### P1-6 · Pruebas que se saltan en silencio

**Portal.** Varias e2e se saltan por condición de datos, no de configuración:

```ts
test.skip((await pestana.count()) === 0, 'Esta build no expone las pestañas de calidad.');
test.skip((await campo.count()) === 0, 'Esta build no expone el formulario del titular.');
test.skip(/Apagado en este entorno/i.test(estado), 'Worker apagado en este motor.');
```

Una regresión que borre la pestaña **deja la prueba en verde**. Es exactamente el
modo de fallo que el propio `CLAUDE.md` describe para el limitador de peticiones:
saltarse en verde sin comprobar nada.

**Motor.** Las suites más críticas para la seguridad son `describe.skip` sin
`DATABASE_URL`: `tenant-rls-isolation`, `rls-guc-contamination`,
`audit-append-only`, `audit-transactional`, `governance-sod`,
`postgres-role-privileges`, `idempotency-*`. `test/setup-env.ts` carga el `.env`
precisamente para evitarlo, pero **nada afirma que esas suites llegaran a
ejecutarse**. Una corrida verde no distingue «el aislamiento funciona» de «no se
midió».

---

## 5. Hallazgos P2 — deuda anotada

1. **Entorno local fuera de contrato.** Node 24.18.1 contra `engines: ">=20.9 <24"`
   y `.nvmrc` = 22. `yarn` no arranca en esta máquina; toda la auditoría se corrió
   con `npx`. Además no hay campo `packageManager`, así que la versión de yarn que
   usa Corepack en CI no está fijada.
2. **El portal no mide cobertura.** `vitest.config.ts` no declara `coverage` ni
   umbral, y la CI no la calcula. 1.092 pruebas sin saber qué tocan.
3. **Playwright sólo en Chromium.** Decisión documentada y con motivo de coste, pero
   un portal de gobierno sin ninguna verificación en WebKit/Firefox es un riesgo
   aceptado que conviene revisar, no uno cerrado.
4. **CSP con `style-src 'unsafe-inline'`.** El `script-src` está bien resuelto
   (nonce + `strict-dynamic`); los estilos no. Faltan además `COEP`/`CORP` y HSTS
   va sin `preload`.
5. **`helmet({ contentSecurityPolicy: false })` en el motor.** Razonable para una
   API pura, pero el motor sirve Swagger cuando está habilitado.
6. **Avisos `act()` de React** en la suite del portal (`InteractiveTutorialProvider`).
   Ruido que enseña a ignorar la salida de las pruebas.
7. **Ramas locales sin podar**: 8 en el motor, 6 en el portal. El motor está
   trabajando sobre `test/workers-integracion-postgres`, un nombre que no describe
   lo que contiene (monitoreo de modelo, gobierno de riesgo, worker de PDF…).
8. **Artefactos pesados en el árbol del motor**: `coverage/` 18 MB, `dist/` 11 MB,
   `logs/`, `backups/`, `site/`.
9. **Postgres y MongoDB de `AtlasBackend` publicados en `0.0.0.0`** en esta máquina
   (`55433`, `27017`). Fuera del alcance de estos dos repos, pero comparten stack
   y entorno de desarrollo.

---

## 6. Calificación

| Dimensión                        | Peso | Nota | Fundamento                                                                                                                           |
| -------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Arquitectura y diseño            | 15 % | 9,0  | 30 módulos, 13 ADR, hexagonal en el worker de PDF, puertas propias de invariantes.                                                   |
| Calidad del código               | 10 % | 9,0  | 0 `any`, 0 TODO reales, lint limpio en ambos, límite de 299 líneas respetado salvo uno.                                              |
| Pruebas                          | 15 % | 7,0  | 1.092 en el portal y 1.559 en el motor, todas verdes; pero ramas al 56 %, cinco controladores sin prueba y saltos silenciosos.       |
| Seguridad                        | 20 % | 5,0  | Postura general excelente (APP_GUARD global, RLS, CSP con nonce, contenedores sin root) **anulada en el perímetro** por P0-1 y P0-2. |
| CI/CD y puertas                  | 15 % | 7,0  | Diseño de puertas excepcional; hoy seis en rojo y el `verify` local no reproduce la CI.                                              |
| Documentación                    | 10 % | 8,0  | 241 documentos y ADR de verdad; desincronizada en 65 operaciones y 87 variables.                                                     |
| Gestión de configuración/entrega | 10 % | 3,0  | 25.000 líneas sin commitear, nada empujado en ocho días, el gate de superficie fuera de git.                                         |
| Observabilidad                   | 5 %  | 9,0  | OpenTelemetry, Jaeger, logger estructurado, métricas con token, interceptores de traza.                                              |

### **Global: 6,9 / 10**

**Lectura de la nota.** Esto no es un 6,9 de sistema mediocre. Es un sistema de 9
en el que la entrega y el perímetro están sin cerrar. Cerrados P0-1 a P0-4 y
P1-1, la nota sube por encima de 8 sin escribir una sola función nueva — el
trabajo ya está hecho, sólo no está protegido ni guardado.

La aritmética de la nota, para que se pueda discutir: 9,0×15 + 9,0×10 + 7,0×15 +
5,0×20 + 7,0×15 + 8,0×10 + 3,0×10 + 9,0×5 = 690 / 100 = **6,90**. Las dos notas
que la hunden son las dos que se arreglan en dos días de trabajo, no en dos
trimestres.

---

## 7. Plan de mejora

Cinco fases. Cada tarea lleva evidencia de cierre: el comando que debe pasar o la
petición que debe cambiar de respuesta. Una tarea sin comprobación no está hecha.

### FASE 0 — Poner a salvo lo que existe (hoy, 2–3 h)

Antes de arreglar nada. Ocho días de trabajo en un solo disco es el riesgo con la
peor relación entre probabilidad y consecuencia de toda esta lista.

**0.1 · Portal: commitear lo que sostiene las puertas.** _(30 min)_

```bash
cd AtlasDecisionEngineFrontend
git add scripts/engine-surface.mjs scripts/engine-surface-paths.mjs \
        scripts/engine-surface.test.mjs \
        docs/superficie-motor.json docs/superficie-no-consumida.md
git commit -m "chore(gates): versionar el inventario de superficie del motor"
```

Primero esto y solo esto: `verify-source.mjs` ya importa `engine-surface.mjs`, así
que **el repositorio publicado hoy no compila su propia puerta**.
_Cierre_: en un clon limpio (`git clone . /tmp/clon && cd /tmp/clon && yarn install
&& yarn verify:source`) la puerta corre y su fallo, si lo hay, es de contenido.

**0.2 · Portal: el resto, en commits temáticos.** _(45 min)_
Sugerencia de corte, no una regla: (a) sistema visual — `styles/parts/*`,
tipografía, interletraje; (b) segundo factor — `LoginClient`, `auth.schemas`,
`AuthProvider`, `login-segundo-factor.spec.ts`; (c) workers de identidad, locución
y extractos; (d) vistas de medición — `decision-quality`, `model-monitoring`,
`risk-governance`; (e) e2e y andamiaje (`buzon-pin.ts`, `identidad-real.ts`).
_Cierre_: `git status --porcelain | wc -l` = 0.

**0.3 · Motor: igual, con las migraciones en su propio commit.** _(45 min)_
Las siete migraciones sin seguir van juntas y solas: son el esquema, y un esquema
mezclado con código en un commit es irrevertible por partes.
_Cierre_: `git status --porcelain | wc -l` = 0 y
`ls prisma/migrations | wc -l` coincide con lo que `_prisma_migrations` tiene
aplicado en la base local.

**0.4 · Empujar ambos a origin.** _(10 min)_

```bash
git push -u origin dev                              # portal
git push -u origin test/workers-integracion-postgres # motor
```

_Cierre_: `git rev-list --left-right --count origin/<rama>...HEAD` → `0 0`.

**0.5 · Renombrar la rama del motor.** _(5 min)_ `test/workers-integracion-postgres`
contiene monitoreo de modelo, gobierno de riesgo y un worker de PDF entero.
Sugerido: `feat/monitoreo-gobierno-y-worker-pdf`.

---

### FASE 1 — Cerrar el perímetro (esta semana, 1–2 días)

**1.1 · Autenticar el worker de PDF.** _(4–6 h)_ — **la tarea de mayor impacto del plan.**

El principio: _el mismo módulo no puede tener dos posturas de seguridad según cómo
se arranque._ Dos caminos, y el segundo es el bueno:

- _Rápido (hoy mismo, mitigación)_: en `docker-compose.pdf-worker.yml` cambiar
  `'${PDF_WORKER_PORT:-3100}:3100'` por `'127.0.0.1:${PDF_WORKER_PORT:-3100}:3100'`.
  Deja de estar en la LAN. **No cierra el hallazgo**: sigue sin autenticación dentro
  de la red `atlas_app`, que es donde vive el portal.
- _Correcto_: un `PdfWorkerAuthGuard` registrado como `APP_GUARD` en
  `PdfWorkerModule.register()`, con clave de servicio (`PDF_WORKER_API_KEY`,
  mínimo 32 caracteres, comparación en tiempo constante — ya existe el patrón en
  `template-admin.guard.ts`). El portal la envía desde `decision-engine-proxy.ts`
  al desviar `pdf/generate` y `pdf/preview`.

Y en el mismo cambio, igualar `src/pdf-worker.ts` con `main.ts`:

```ts
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
app.enableCors({ origin: allowedOrigins.length ? /* … */ : false, credentials: true });
// Swagger: por omisión APAGADO, no encendido
if (process.env.PDF_SWAGGER_ENABLED === 'true') { /* … */ }
```

_Cierre_ — las cuatro peticiones tienen que cambiar de respuesta:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/pdf/templates          # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3100/pdf/generate \
     -H 'Content-Type: application/json' -d '{}'                                       # 401, no 422
curl -s -o /dev/null -w '%{http_code}\n' -H "x-api-key: $PDF_WORKER_API_KEY" \
     http://localhost:3100/pdf/templates                                               # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/docs                    # 404
```

Más una prueba de regresión en `test/` que afirme el 401 sin clave, para que el día
que alguien añada un controlador al worker no vuelva a nacer abierto.

**1.2 · Escribir el ADR que falta.** _(1 h)_ Ampliar ADR-0031 con la sección de
autenticación: qué protege el worker, quién puede llamarlo, por qué una clave de
servicio y no JWT, y qué se pierde al desviar `pdf/generate` fuera del interceptor
de auditoría del motor (§3, P0-1). _Cierre_: `yarn docs:links` ya no lo lista huérfano.

**1.3 · Las tres vulnerabilidades altas.** _(3–4 h)_

```bash
cd AtlasDecisionEngine
yarn up pdfjs-dist@^6.2.108   # ejecución arbitraria de JS al abrir un PDF
yarn up sharp@^0.35.0         # CVEs de libvips
yarn up @nestjs/swagger       # arrastra js-yaml ≥ 4.3.1; si no, `resolutions`
yarn security:audit           # debe salir 0
```

`sharp` 0.35 cambia binarios de plataforma: verificar el worker de identidad
completo (Tesseract + `@vladmandic/human` sobre WebAssembly) y `pdfjs-dist` 6.x
puede mover la API de extracción de texto — el parser de extractos es el que más
riesgo de regresión tiene.
_Cierre_: `yarn security:audit` en verde **y** `yarn playwright test
e2e/portal-real-identidad.spec.ts` y `e2e/portal-real-extracto.spec.ts` en verde
contra el motor real (de uno en uno, respetando el limitador).

**1.4 · Desatascar `migration:validate`.** _(1 h)_ Reescribir el bloque de
`20260813010000_audio_segment_cache` con el idioma que el resto de migraciones ya
usa (estático entrecomillado o dinámico con `%I`). **No tocar la expresión regular
del validador para que acepte literales sueltos**: aceptaría también SQL comentado
y la puerta dejaría de proteger el aislamiento entre inquilinos.
Después, añadir al validador un aviso explícito cuando encuentre `EXECUTE '…ROW
LEVEL SECURITY…'` sin `%I`, que diga «idioma no soportado, usa X» — hoy dice
«falta RLS», que es lo contrario de lo que pasa y manda a buscar al sitio erróneo.
_Cierre_: `yarn migration:validate` con código 0.

**1.5 · Atar los puertos del entorno de desarrollo.** _(30 min)_ Todo lo que no
tenga que salir de la máquina, a `127.0.0.1`: el worker de PDF, y —fuera de estos
repos pero en el mismo stack— Postgres (`55433`) y MongoDB (`27017`) de
`AtlasBackend`. _Cierre_: `docker ps --format '{{.Names}} {{.Ports}}' | grep '0.0.0.0'`
sólo devuelve lo que de verdad tiene que ser alcanzable.

---

### FASE 2 — Volver a poner las puertas en verde (esta semana, 4–6 h)

**2.1 · Formato, en ambos.** _(20 min)_

```bash
cd AtlasDecisionEngineFrontend && npx prettier --write docker-compose.yml
cd ../AtlasDecisionEngine     && npx yarn format     # los 50 ficheros
```

Commit aparte, con mensaje `style:`, para que no contamine la revisión del código.

**2.2 · Arreglar la causa raíz, no los 50 ficheros.** _(15 min)_ En el
`package.json` del motor:

```jsonc
"verify":         "yarn format:check && yarn lint && yarn typecheck && yarn build && yarn test",
"verify:release": "yarn verify && yarn migration:validate && yarn security:audit && yarn docs:validate",
```

Sin esto, dentro de dos semanas vuelve a haber cincuenta ficheros derivados. Una
puerta local que dice verde donde la remota dice rojo entrena a no correr la local.

**2.3 · El fichero de 301 líneas.** _(1 h)_
`src/pages/IdentityVerificationWorkerPage.tsx`. Extraer a
`src/features/workers/identity/` el bloque que mejor se sostenga solo — el aviso de
perfil sin calibrar y la lectura de `limits.*Provider` son candidatos naturales, ya
tienen su propia explicación en el código.
_Cierre_: `node scripts/verify-source.mjs` con código 0.

**2.4 · Documentación del motor al día.** _(3–4 h)_

```bash
yarn docs:openapi:generate && yarn docs:catalog && yarn docs:report
```

Y a mano lo que el generador no puede saber:

- Los **8 esquemas de respuesta** que faltan (regla de fallo duro, sin deuda
  admitida). Un endpoint sin cuerpo declarado no lo puede consumir nadie sin leer
  el código.
- Las **87 variables de entorno**, empezando por las que cambian comportamiento en
  producción: familia `PDF_*`, `UNRESOLVED_*`, `IDENTITY_PROVIDER_LOGIN_TIMEOUT_MS`,
  `DATA_READ_ROUTING_ENABLED`.
- Los **5 huérfanos** en `mkdocs.yml`: ADR-0030, ADR-0031 y los tres de
  `docs/pdf-worker/`.

_Cierre_: `yarn docs:validate` con código 0, y añadirlo a la CI como paso propio.

---

### FASE 3 — Que lo verde signifique algo (2–3 semanas)

Las puertas en verde de la Fase 2 son necesarias pero no suficientes: hoy una
corrida verde tampoco distingue «se comprobó» de «no se midió».

**3.1 · Prohibir el salto silencioso en e2e.** _(4 h)_

La regla: **un salto por CONFIGURACIÓN es legítimo; un salto por DATOS es un fallo
disfrazado.** `test.skip(!PW_USER)` está bien —no hay credenciales, no hay nada que
medir—. `test.skip(count() === 0)` no: si la pestaña desapareció, eso _es_ el
defecto que la prueba existía para encontrar.

Convertir en aserción todos los saltos por datos de `portal-real-circuito.spec.ts`
y `portal-real-generadores.spec.ts`. Para el caso de worker apagado, distinguir
las dos cosas: consultar el catálogo _antes_ y, si el worker debía estar encendido
en este entorno, **fallar**; saltar sólo cuando el propio entorno declara que no lo
tiene.

_Cierre_: `grep -rn "test.skip(" e2e/ | grep -v "HAY_CREDENCIALES\|PW_"` no devuelve
nada, o cada superviviente lleva encima el comentario de por qué es configuración.

**3.2 · Que las suites de aislamiento no puedan saltarse en la CI.** _(3 h)_
Añadir un `globalSetup` de jest que, cuando `CI=true` o `REQUIRE_DB_SUITES=true`,
falle si `DATABASE_URL` no está. Y una prueba centinela que afirme que el número de
suites `describe.skip` ejecutadas es cero en ese modo.
Razón: `tenant-rls-isolation`, `rls-guc-contamination`, `audit-append-only`,
`governance-sod` y `postgres-role-privileges` son las pruebas que sostienen las
afirmaciones regulatorias del sistema. Que se salten en silencio es peor que no
tenerlas: una corrida verde afirma algo que no se midió.
_Cierre_: quitar `DATABASE_URL` con `CI=true` pone la corrida en rojo con un
mensaje que dice exactamente qué falta.

**3.3 · Los cinco controladores sin prueba.** _(2–3 días)_
Prioridad estricta: `outcome-ingestion` primero —escribe evidencia regulatoria—,
después `pdf-generation` y `pdf-template-admin` (ahora que tienen guardia, hay que
afirmar que el guardia está), y luego `semantic-category` y `pdf-catalog`.
Mínimo por controlador: camino feliz, autorización denegada, y validación de
entrada rechazada.
_Cierre_: el bucle que detectó el hueco no devuelve nada —

```bash
for c in $(find src -name '*.controller.ts' | sed 's#.*/##;s#\.controller\.ts##'); do
  grep -rql "$c" test --include='*.spec.ts' >/dev/null || echo "sin prueba: $c"
done
```

**3.4 · Subir el suelo de cobertura de ramas.** _(continuo)_
De 45 % a **60 %** en el umbral global, y de 77 % a 82 % en `./src/modules/graph/`.
Subir el número _después_ de escribir las pruebas, nunca antes: un umbral por
encima de lo medido es una CI roja permanente, y una CI roja permanente se ignora.
Rutina: cada PR que toque `src/modules/graph/` o `src/modules/runtime/` no puede
bajar la cobertura de ramas de ese directorio.

**3.5 · Medir cobertura en el portal.** _(2 h)_

```ts
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text-summary', 'json-summary', 'lcov'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
  thresholds: { lines: 0, branches: 0, functions: 0 },  // medir primero
}
```

Correrla, leer el número real, y **entonces** fijar el suelo justo por debajo —el
mismo método que usó el motor, que es el correcto—. Publicar el resumen como
artefacto de la CI.

**3.6 · Silenciar los avisos `act()`.** _(2 h)_ `InteractiveTutorialProvider` en la
suite del portal. Ruido que enseña a no leer la salida de las pruebas, y una suite
cuya salida nadie lee es una suite que ya no informa.

---

### FASE 4 — Pagar la deuda de gobierno (1–2 meses)

Las siete operaciones del §4, P1-5 no son endpoints sueltos: son capacidades que el
motor ya tiene y que **nadie puede usar desde donde se supone que se gobierna el
sistema**. Por orden de consecuencia:

**4.1 · Reversión y suspensión de despliegues en el portal.** _(1 semana)_
`POST /v1/deployments/{id}/rollback` y `/suspend`. Hoy, revertir un despliegue en
producción se hace por fuera —sin el registro que el portal aporta, sin motivo
escrito, sin quién—. Es la laguna más cara de las siete: el momento en que más
importa saber quién decidió qué es exactamente el incidente.
Requisitos: confirmación explícita, motivo obligatorio, y la acción visible en el
registro de auditoría con actor y sello.

**4.2 · Verificación de la cadena de auditoría, con pantalla.** _(3 días)_
`GET /v1/audit/chain/verify`. Una cadena de integridad que sólo se comprueba por
consola es una cadena que sólo comprueba quien ya sabe que existe — y quien audita
no entra por consola. Vista sencilla en `/audit-events`: estado, último bloque
verificado, sello temporal, y el resultado en lenguaje llano.

**4.3 · Asignación de revisión manual.** _(2 días)_
`POST /v1/manual-reviews/{id}/assign`. Cierra el flujo: hoy se resuelve dentro y se
asigna fuera, y esa mitad fuera no deja traza.

**4.4 · Exportación del informe de revisión de seguridad.** _(1 día)_
`GET /v1/security-review/versions/{id}/export`. Un botón.

**4.5 · Catálogo de propiedades de QA Lab desde el motor.** _(2 días)_
`GET /v1/qa-lab/properties`. Hoy está fijado en cliente: una propiedad nueva del
motor no aparece sola, así que el motor puede ganar capacidad y el portal no
enterarse — que es la misma clase de fallo que el gate de superficie existe para
detectar.

**4.6 · Un solo diff de versiones.** _(2 días)_
`GET /v1/artifact-versions/{id}/diff/{id}` frente a
`features/governance/version-diff.ts`. Dos implementaciones de la misma
comparación **que pueden discrepar**; en un artefacto de gobierno, dos respuestas
distintas a «qué cambió» es peor que ninguna. Decidir cuál manda —recomendado: el
motor, que es quien tiene la verdad— y borrar la otra.

**4.7 · Revisar cada exención escrita.** _(medio día, trimestral)_
`docs/superficie-no-consumida.md` funciona porque se lee. Meterlo en el calendario:
cada trimestre, alguien confirma que cada motivo sigue siendo cierto. Una lista de
deuda que nadie revisa se convierte en una lista de permisos.

---

### FASE 5 — Endurecer lo que ya está bien (continuo)

**5.1 · Alinear el entorno de desarrollo.** _(1 h)_ Node local 24.18.1 contra
`engines: <24`. O se instala Node 22 (`nvm use`, ya hay `.nvmrc`), o se sube el
rango tras verificar la build. Y añadir `"packageManager": "yarn@1.22.22"` a ambos
`package.json` para que Corepack no elija versión por su cuenta.

**5.2 · Cerrar `style-src` en el portal.** _(4 h)_ El `script-src` ya está
resuelto con nonce y `strict-dynamic`; los estilos siguen con `'unsafe-inline'`.
Extender el nonce a los estilos en línea y, cuando ya no queden, quitarlo. Añadir
`Cross-Origin-Embedder-Policy` y `Cross-Origin-Resource-Policy`, y evaluar
`preload` en HSTS (irreversible en la práctica: decidirlo por escrito antes).

**5.3 · Un navegador más en la e2e.** _(1 día)_ WebKit sobre un subconjunto
—acceso, un worker, un diálogo, una tabla densa— en una corrida nocturna, no en
cada PR. El argumento de coste para no correr los tres en cada PR es correcto; el
de no correrlos nunca, no.

**5.4 · Acortar la batería del motor.** _(1 día)_

Medido: **164 suites, 1.559 pruebas, 2 saltadas, 1.671 s (27,9 min)**, en verde, y
eso **excluyendo** las de integración. El proceso llegó a 2,82 GB de residente.

> _Nota de método_: mi primera lectura fue «>65 min sin terminar». Era reloj de
> pared, contaminado por un `next build` y una corrida de vitest que yo mismo tenía
> en paralelo en la misma máquina. El número bueno es el de jest: 27,9 min. Del
> mismo modo, **no queda establecida ninguna fuga de memoria**: 2,8 GB en un único
> proceso que carga 164 suites con ts-jest es alto pero no anómalo por sí solo, y
> el crecimiento que observé no se midió por fichero. Queda como sospecha a
> comprobar, no como hallazgo.

Aun en verde, 28 minutos es una suite que no se corre antes de commitear: el ciclo
de realimentación pasa de minutos a la duración de un pipeline, y ahí es donde
empiezan a colarse los commits que rompen algo lejano.

Diagnóstico, en este orden:

```bash
# ¿Hay retención real entre ficheros? El heap tras cada suite lo dice.
node_modules/.bin/jest --runInBand --logHeapUsage
# ¿Queda algo vivo al terminar? (sockets de Prisma, setInterval del outbox, Redis)
node_modules/.bin/jest --runInBand --detectOpenHandles
```

Un escalón de heap que nunca baja señala al fichero culpable; lo habitual en NestJS
es un `Test.createTestingModule(...)` sin `app.close()` en `afterAll`.

Corrección, en orden de rendimiento por esfuerzo:

- **Separar en dos proyectos de jest** —unitario puro y con base de datos—.
  `--runInBand` sólo es obligatorio donde hay una base compartida; hoy penaliza
  también a las suites que no la tocan, que son la mayoría. Esto solo debería
  bajar la corrida de desarrollo a pocos minutos.
- `afterAll(async () => { await app?.close(); })` en toda suite que monte un módulo
  de prueba, con un helper compartido en `test/` para que no dependa de que cada
  autor se acuerde.
- `--workerIdleMemoryLimit` como presupuesto explícito, para que una regresión
  futura falle en vez de degradarse en silencio.

_Cierre_: la corrida unitaria pura baja de 5 minutos y `--logHeapUsage` muestra el
heap oscilando, no creciendo monótonamente.

**5.5 · Limpiar el árbol y las ramas.** _(1 h)_ Ocho ramas locales en el motor,
seis en el portal, ninguna con push reciente. Podar las fusionadas, publicar las
vivas. Y comprobar que `coverage/`, `dist/`, `logs/`, `backups/` y `site/` están en
`.gitignore` — 30 MB de artefactos regenerables en el árbol de trabajo.

---

## 8. Orden de ataque, en una tabla

| #   | Tarea                                       | Fase | Esfuerzo | Riesgo si no se hace                                         |
| --- | ------------------------------------------- | ---- | -------- | ------------------------------------------------------------ |
| 1   | Commitear y empujar ambos repos             | 0    | 2 h      | Pérdida total de 8 días de trabajo ante un fallo de disco    |
| 2   | Versionar el gate de superficie             | 0    | 30 min   | El repositorio publicado no compila su propia puerta         |
| 3   | Autenticar el worker de PDF                 | 1    | 6 h      | Servicio sin credencial expuesto en la LAN                   |
| 4   | Actualizar `pdfjs-dist`, `sharp`, `js-yaml` | 1    | 4 h      | Ejecución arbitraria desde un PDF subido por un usuario      |
| 5   | Desatascar `migration:validate`             | 1    | 1 h      | La puerta de aislamiento entre inquilinos, ciega             |
| 6   | `format:check` dentro de `verify` del motor | 2    | 15 min   | La deriva de 50 ficheros se repite                           |
| 7   | Formato + fichero de 301 líneas             | 2    | 1,5 h    | CI en rojo en ambos repos                                    |
| 8   | `docs:validate` en verde y en la CI         | 2    | 4 h      | 65 operaciones y 87 variables que sólo conoce quien las hizo |
| 9   | Saltos silenciosos en e2e y suites de RLS   | 3    | 7 h      | Corridas verdes que no comprueban nada                       |
| 10  | Pruebas de `outcome-ingestion`              | 3    | 1 día    | Evidencia regulatoria escrita sin ninguna prueba             |
| 11  | Reversión/suspensión de despliegues         | 4    | 1 semana | Revertir producción sin registro de quién ni por qué         |

---

_Auditoría ejecutada el 13 de agosto de 2026. Las puertas se corrieron sobre el
árbol de trabajo, no sobre HEAD: con 415 y 203 ficheros sin commitear, HEAD no
describe lo que hay._
