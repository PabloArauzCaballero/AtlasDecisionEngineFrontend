# Plan — Auditoría de seguridad del portal y mapeo a COBIT 5

- Fecha: 2026-10-28 · Repos afectados: `AtlasDecisionEngineFrontend` (únicamente) · Predecesor: ninguno
- Resultado observable: quien despliega el portal tiene una lista de hallazgos de seguridad
  verificados leyendo el código real, con los confirmados corregidos y cada uno mapeado a un
  proceso de COBIT 5, más la evidencia técnica de lo ejecutado.
- Kill-test: `yarn audit --groups dependencies` sigue marcando `next` como crítico, o
  `assertSafeApiPath('/\\otro-host/x')` no lanza.
- Aviso de marco: COBIT 5 es un marco de GOBIERNO y gestión de TI. Este trabajo entrega el mapeo
  hallazgo → proceso y la evidencia técnica; **no es una certificación ni una evaluación de
  madurez de procesos**.

## Alcance

- IN: sandbox del cuaderno (`src/features/data-notebook/sandbox/*`, `src/app/notebook-sandbox`),
  CSP y cabeceras (`src/middleware.next.ts`, `next.config.ts`), proxies (`src/server/*`,
  `src/app/{v1,pdf,atlas-backend,health,metrics}`), sesión y cliente HTTP (`src/auth/*`,
  `src/api/*`), `engine-sql.ts`, markdown del cuaderno, renderizado de documentos de terceros,
  `NEXT_PUBLIC_*`, Dockerfile y compose, E2E, dependencias.
- OUT: cualquier otro repositorio (motor, AtlasBackend, ERP, portal administrativo); infraestructura
  de despliegue; pruebas de penetración dinámicas contra un entorno vivo.
- Ambigüedades registradas:
  - ¿`zod` 3.x está afectado por GHSA-mrhx-c7xc-m3w5, que describe `$ZodArray` de la 4.x? Supuesto:
    el aviso de `yarn audit` es por rango de versión, no por código. Se registra, no se resuelve
    subiendo a una mayor. Confirmar con: responsable del portal.
  - Cómo sirve el motor `GET /v1/workers/bank-statement/reviews/:id/document` (tipo de contenido).
    Supuesto: `application/pdf`. Confirmar con: responsable del motor.

## H1 — Cadena de suministro sin avisos críticos corregibles en rango

**CA:** Dado el árbol de dependencias de producción, cuando se ejecuta `yarn audit --groups
dependencies`, entonces no quedan avisos `critical` ni el `high` de `next`, y las dependencias
siguen resolviendo dentro del rango declarado.
**DoD:** `yarn audit` pegado antes y después · `yarn typecheck` · `yarn test` · `yarn build`
(`NEXT_DIST_DIR=.next-audit`).
**Estado:** HECHO

| ID       | Microtarea                                                          | CA (binario)                    | DoD                                    | Estado |
| -------- | ------------------------------------------------------------------- | ------------------------------- | -------------------------------------- | ------ |
| H1.S1.M1 | Subir `next` a `^16.4.1` (lockfile)                                 | `next` instalado >= 16.4.1      | `yarn audit` sin avisos de `next`      | HECHO  |
| H1.S1.M2 | Subir la resolución de `dompurify` a `^3.4.17`                      | `dompurify` instalado >= 3.4.17 | `yarn audit` sin avisos de `dompurify` | HECHO  |
| H1.S1.M3 | Registrar `zod` (alto, mayor 4.x) como no corregido, con mitigación | Decisión escrita en el reporte  | `REPORTE.md`                           | HECHO  |

## H2 — Defensa en profundidad del cliente

**CA:** Dado cualquier ruta de API o documento de tercero, cuando el cliente lo usa, entonces una
ruta con `\` o caracteres de control no sale del origen y un documento del expediente se pinta
siempre con el tipo `application/pdf` en el `<iframe>`.
**DoD:** pruebas nuevas en verde · `yarn verify:source` · `yarn lint`.
**Estado:** HECHO

| ID       | Microtarea                                                                        | CA (binario)                                                                                  | DoD                                             | Estado |
| -------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------ |
| H2.S1.M1 | `assertSafeApiPath` rechaza `\`, controles y todo lo que `isInternalPath` rechaza | `/\\x`, `/\t/x`, `//x`, `x` lanzan `INVALID_API_PATH`; las rutas reales siguen pasando        | `yarn vitest run src/api/http-client.test.ts`   | HECHO  |
| H2.S1.M2 | El visor del extracto reenvuelve el blob con `application/pdf`                    | El `blob.type` que llega al `<iframe>` es `application/pdf` aunque el servidor diga otra cosa | `yarn vitest run src/features/workers/pdf-blob` | HECHO  |

## H3 — Verificación y cierre

**CA:** Dado el árbol con los cambios, cuando se corren los gates, entonces todos terminan con
código de salida 0 (o se declaran BLOQUEADO con el error literal).
**DoD:** `yarn format:check`, `yarn lint`, `yarn verify:source`, `yarn verify:help`,
`yarn typecheck`, `yarn test`, `NEXT_DIST_DIR=.next-audit yarn build`.
**Estado:** HECHO

| ID       | Microtarea                                    | CA (binario)                             | DoD                   | Estado |
| -------- | --------------------------------------------- | ---------------------------------------- | --------------------- | ------ |
| H3.S1.M1 | Correr los gates en serie y guardar la salida | Código 0 en cada uno                     | `evidencia/*.txt`     | HECHO  |
| H3.S1.M2 | Escribir `REPORTE.md` con el mapeo COBIT 5    | Archivo con las secciones de la regla 40 | `plan_status`/lectura | HECHO  |

## Descubrimiento (hechos con ruta, sin cambios de código)

Revisado y **sin hallazgo** (falsos positivos descartados, con la razón):

- Sandbox del cuaderno: `sandbox/cliente.ts:escuchar` exige ventana exacta + origen `null`;
  `documento.ts` exige `evento.source === parent` y `origin === PORTAL`; el `<iframe>` lleva
  `sandbox="allow-scripts"` sin `allow-same-origin`; el código de celdas corre en workers.
- CSP (`middleware.next.ts`): nonce nuevo por petición, `'unsafe-eval'` solo en desarrollo.
- Proxies: `upstream.ts:isUnsafePathSegment/buildUpstreamUrl` bloquean `..` codificado; el destino
  lo fija el entorno (no hay SSRF por entrada); `atlas-backend-allowlist.ts` es lista blanca.
- `engine-sql.ts`: las cinco puertas están en el código y probadas.
- `markdown.ts`: sin HTML; `javascript:` queda como texto; `rel="noreferrer"`.
- `?from=` del login: `utils/internal-path.ts` resuelve contra un origen fijo.
- Sin secretos versionados (búsqueda de patrones), `.env*` ignorados, imagen no-root.

## Riesgos y bloqueos previstos

| Riesgo                          | Impacto | Mitigación                                                                                     |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| Subir `next` rompe la build     | alto    | Compilar a `.next-audit`, revertir `tsconfig.json`, leer guía en `node_modules/next/dist/docs` |
| Sin red el registro no resuelve | medio   | BLOQUEADO con el error literal                                                                 |
