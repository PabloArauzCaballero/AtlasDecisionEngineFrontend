> **AVANCE: 7 / 7 — 100,0 %.**

- Fecha: 2026-10-28 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/gallant-thompson-wp8f28`
- Peldaño de evidencia alcanzado: `TESTED` en las áreas tocadas (pruebas dirigidas y la suite completa en verde, tipos, lint y build con código 0). No se llegó a `VERIFIED`: no se ejercitó el portal en un navegador ni el servidor construido.
- Aviso de marco: COBIT 5 es un marco de gobierno y gestión de TI. Este documento entrega el mapeo hallazgo → proceso y la evidencia técnica de lo ejecutado; **no es una certificación ni una evaluación de madurez de procesos**. El 100 % mide microtareas del plan, no cobertura de la auditoría (ver «No cubierto»).

## Completado

| ID       | Qué se logró                                                        | Comando                                                | Resultado                                                                       |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| H1.S1.M1 | `next` 16.3.8 → 16.4.3 (rango `^16.4.1`)                            | `yarn audit --groups dependencies`                     | PASS: de 3 críticos a 0; ver `evidencia/01-…` y `02-…`                          |
| H1.S1.M2 | `dompurify` (vía `monaco-editor`) 3.4.13 → 3.4.17 con `resolutions` | idem                                                   | PASS: sin avisos de `dompurify`                                                 |
| H1.S1.M3 | `zod` registrado como no corregido, con mitigación                  | —                                                      | Ver «Decisiones»                                                                |
| H2.S1.M1 | `assertSafeApiPath` usa `isInternalPath`                            | `npx vitest run src/api …`                             | PASS (90 pruebas); el caso nuevo FALLA con el código anterior: `evidencia/04-…` |
| H2.S1.M2 | El visor del extracto fija `application/pdf` al blob del `<iframe>` | `npx vitest run src/features/workers/pdf-blob.test.ts` | PASS                                                                            |
| H3.S1.M1 | Gates en serie                                                      | ver «Evidencia»                                        | PASS, todos con código 0                                                        |
| H3.S1.M2 | Este reporte                                                        | —                                                      | Escrito                                                                         |

## A medias

Ninguna.

## Pendiente

| ID                                                                                      | Estado                       | Qué lo destraba                                                                                          |
| --------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Subir `zod` a 4.x                                                                       | DESCARTADO (en este trabajo) | Decisión del responsable del portal: es un cambio de versión mayor con API distinta; ver «Decisiones»    |
| Dependencias de desarrollo (`vitest`, `vite`, `tinypool`, `js-yaml`, `brace-expansion`) | TODO                         | Tarea propia: `vitest` 3 → 4 es una mayor. No llegan al artefacto desplegado                             |
| Migrar `middleware` → `proxy` (aviso de Next 16 en la build)                            | TODO                         | Tarea propia: renombrar el archivo cambia la convención del CSP con nonce y exige verificar en navegador |

## Hallazgos y mapeo a COBIT 5

Severidad según la del aviso público o mi estimación (marcada «est.»). Estado: C = corregido en este trabajo.

| ID   | Sev.                 | Dónde                                                                                                                                                                                                                                 | CWE / OWASP                                 | COBIT 5                      | Estado                                  |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------- | --------------------------------------- |
| F-01 | Crítica              | `package.json`, `yarn.lock`: `next` 16.3.8 (GHSA-2464-fhr4-w9xw RCE en optimización de imágenes; GHSA-673q-mjm6-r5xr RCE en `use cache`; GHSA-p3m5-59mp-jv5r DoS con Server Actions)                                                  | CWE-1395, CWE-502, CWE-770 · A06:2021       | DSS05.01, BAI06.01, APO12.02 | C                                       |
| F-02 | Alta (aviso)         | `yarn.lock`: `zod` 3.25.x (GHSA-mrhx-c7xc-m3w5, memoria con arreglos grandes)                                                                                                                                                         | CWE-770 · A06                               | APO12.02, BAI03              | No corregido                            |
| F-03 | Crítica/alta (aviso) | `monaco-editor` → `dompurify` 3.4.13 (GHSA-cg2g-xh64-v4q7 y otros)                                                                                                                                                                    | CWE-79 · A06                                | DSS05.01, BAI06.01           | C                                       |
| F-04 | Baja (est.)          | `src/api/api-path.ts:14`: `/\otro-host/x` y `/<tab>/otro-host/x` pasaban `assertSafeApiPath` y el navegador los resuelve a `//otro-host/x`, con el `Authorization` puesto                                                             | CWE-601 / CWE-918 (lado cliente) · A01, A10 | DSS05.02, DSS06.06, BAI03    | C                                       |
| F-05 | Baja (est.)          | `src/features/workers/StatementDocumentViewer.tsx`: PDF de un cliente en `<iframe src=blob:>` del mismo origen con el tipo que declare el servidor                                                                                    | CWE-79, CWE-434 · A03, A04                  | DSS05.03, DSS06.06           | C (defensa en profundidad)              |
| F-06 | Baja (est.)          | `baseline-browser-mapping` 2.10.43 (GHSA-w5vr-8v7q-w6rv, solo build)                                                                                                                                                                  | CWE-248                                     | BAI06.01                     | C (vía `resolutions`)                   |
| O-01 | Info                 | Dependencias de desarrollo con avisos (`evidencia/02b-…`: 2 críticos `tinypool`, 6 altos)                                                                                                                                             | CWE-1321 · A06                              | APO12.02, MEA01.03           | No corregido: solo desarrollo y pruebas |
| O-02 | Info                 | `src/features/data-notebook/sandbox/documento.ts:politicaDelSandbox` compone `connect-src` con la cabecera `Host` (validada con regex). Solo afecta a la respuesta de quien la pide, `no-store`; no es explotable contra otra persona | CWE-644                                     | DSS05.02                     | No corregido                            |
| O-03 | Info                 | `src/app/version/route.next.ts` publica commit y entorno sin sesión (decisión documentada PLAT-03)                                                                                                                                    | CWE-200                                     | APO13.01, DSS05.02           | No corregido                            |
| O-04 | Info                 | `e2e/support/buzon-pin.ts:63` escucha en todas las interfaces y guarda PIN de cuentas de prueba                                                                                                                                       | CWE-1327                                    | DSS05.02                     | No corregido: Docker en Linux lo exige  |
| O-05 | Info                 | `OnboardingDossierDevice.tsx:25` pone latitud y longitud de un cliente en la URL de Google Maps al pulsar                                                                                                                             | CWE-598 · regla 90.2.2                      | DSS06.06, APO13.03           | No corregido: decisión de producto      |
| O-06 | Info                 | `style-src 'unsafe-inline'` en la CSP del portal (documentado: Next inyecta estilos al hidratar)                                                                                                                                      | CWE-693                                     | DSS05.02                     | No corregido: aceptado y documentado    |

Cómo se mapea el resto de procesos pedidos: APO13.01/.02/.03 (sistema de gestión de seguridad) lo cubren el plan, las reglas de la casa y los gates de este repositorio (`verify:source`, `audit-high.mjs`); este trabajo aportó la revisión de ese control, no la creó. MEA01–03 (supervisión, control interno y cumplimiento) corresponden a la repetición periódica de `yarn audit` y de los gates, que hoy no corre en una CI propia: ver «Riesgos residuales».

## Revisado sin hallazgo (falsos positivos descartados)

- **Escape del sandbox del cuaderno.** `sandbox/cliente.ts:escuchar` exige la ventana exacta de un marco propio y el origen `null`; `documento.ts` y `r-anfitrion.ts` exigen `evento.source === parent` y `origin === location.origin`; el `<iframe>` lleva `sandbox="allow-scripts"` sin `allow-same-origin`; el código de las celdas corre en workers de `blob:`; la CSP del marco limita la red a `/pyodide/` o `/webr/`. El único `postMessage(…, '*')` (`cliente.ts`) es obligado con origen opaco y apunta a la ventana de un marco que creamos.
- **CSP.** Nonce nuevo por petición (`crypto.randomUUID`), sin `'unsafe-eval'` fuera de desarrollo; el de `'wasm-unsafe-eval'` y el de `'unsafe-eval'` del marco de R están acotados y documentados.
- **Proxies.** `upstream.ts:isUnsafePathSegment` rechaza `.`/`..`/barras con hasta cuatro capas de codificación; el destino sale del entorno, no de la entrada (sin SSRF); `atlas-backend-allowlist.ts` es lista blanca por ruta y método; `/metrics` falla cerrado sin token y compara en tiempo constante; `/health` solo abre tres sondas; se descartan las cabeceras de procedencia del navegador.
- **Sesión.** El token de acceso vive en memoria (`AuthProvider`), no en `localStorage`; `localStorage` guarda solo tenant y correo (`LoginClient.tsx`); `clearSessionData` borra SQL de consola y copia del simulador al cerrar sesión.
- **Redirección abierta.** `?from=` pasa por `safeInternalPath`.
- **XSS.** Los únicos `dangerouslySetInnerHTML` son el script del tema, constante, con nonce. `markdown.ts` no genera HTML; `javascript:` queda como texto.
- **SQL (`engine-sql.ts`).** Las cinco puertas están en el código y probadas (catálogo, citado, columna de la relación, enteros, forma final).
- **Secretos.** Sin patrones de claves ni credenciales versionadas; `.env*` ignorados; `NEXT_PUBLIC_*` solo lleva URL base, plazos y etiquetas.
- **Imagen.** Usuario no-root, `node` fijado por digest, `.dockerignore` excluye `.env*`, intérpretes verificados por SHA-256 al construir.

## Evidencia

Todo en `docs/trabajo/2026-10-28-auditoria-cobit5-seguridad/evidencia/`:

```text
01-yarn-audit-antes.txt            RESUMEN {"info":0,"low":3,"moderate":1,"high":3,"critical":3}
02-yarn-audit-despues.txt          RESUMEN {"info":0,"low":0,"moderate":0,"high":1,"critical":0}   (solo zod)
02b-yarn-audit-con-dev.txt         RESUMEN {"info":0,"low":2,"moderate":10,"high":6,"critical":2}  (incluye desarrollo)
03-tests-dirigidos.txt             Test Files 9 passed (9) · Tests 90 passed (90)
04-kill-test-codigo-anterior.txt   con api-path.ts anterior: http-client.test.ts → 1 failed (el caso nuevo)
gate-format-check.txt              All matched files use Prettier code style!  exit=0
gate-lint.txt                      exit=0
gate-verify-source.txt             Source verification passed for 1260 files …  exit=0
gate-verify-help.txt               check-field-help: 275 campos … 48 opciones …  exit=0
gate-typecheck.txt                 exit=0
gate-test.txt                      Test Files 221 passed (221) · Tests 1682 passed (1682)  exit=0
gate-build.txt                     Next.js 16.4.3 (Turbopack) … Compiled successfully  exit=0
```

La suite no incluye `yarn test:e2e` ni `yarn security:audit` (ver «No cubierto»). El `yarn.lock` y `package.json` modificados llevan: `next ^16.4.1`; `resolutions`: `dompurify ^3.4.17`, `baseline-browser-mapping ^2.11.0`.

## No cubierto

- Ningún navegador: ni el portal con la `next` nueva, ni el cuaderno (Pyodide, WebR, JavaScript), ni el visor de PDF. Un `next` 16.3 → 16.4 es un salto menor y la build compila; el comportamiento en ejecución no se observó.
- E2E de Playwright (`yarn test:e2e`, `test:e2e:prod`): no se ejecutaron (necesitan motor, usuario y datos).
- `yarn security:audit` (`scripts/audit-high.mjs`, el gate del repositorio): no se ejecutó; se usó `yarn audit --json` directamente.
- Pruebas dinámicas contra un entorno vivo (cabeceras reales, CORS, cookies `HttpOnly`/`SameSite` del motor): esas cookies las fija el motor, fuera de este repositorio.
- Autorización real de los endpoints de AtlasBackend y del motor: el portal no autoriza; esa verificación corresponde a sus repositorios.
- Impacto real de GHSA-2464-fhr4-w9xw: el portal no usa `next/image` y el optimizador queda activo por omisión; no se probó contra `/_next/image`. Se parcheó por versión.
- Monaco con DOMPurify 3.4.17: no se probó en pantalla.

## Desvíos del plan

- Se añadió la resolución `baseline-browser-mapping ^2.11.0` (F-06), que el plan no preveía: apareció en `yarn audit` tras subir `next`. Primero `yarn upgrade <paquete>@<rango>` lo agregó como dependencia directa; se revirtió y se dejó solo en `resolutions`, que es el patrón que ya usa el repositorio.
- La prueba de F-04 se añadió a `http-client.test.ts` y no a un archivo propio, porque ahí vive la prueba hermana de `assertSafeApiPath`.
- El plan nombraba `statement-document-blob`; el archivo quedó como `pdf-blob.ts` (`asPdfBlob`). El plan se corrigió.

## Riesgos residuales y deuda

- `zod` 3.x con aviso alto (F-02). Mitigación en el código: los arreglos que vienen del marco del cuaderno llevan `.max(...)` y el mensaje entero se mide contra `MAX_CARACTERES_MENSAJE` (32 MiB) antes de validar la carga (`sandbox/protocolo.ts:leerMensajeDelSandbox`). Las respuestas del motor son de un origen de confianza. El aviso describe `$ZodArray` de la 4.x; si aplica a la 3.x o no, no se verificó.
- Sin CI propia (CLAUDE.md): nadie repite `yarn audit` por sí solo. Mientras no exista, los avisos nuevos de `next` vuelven a aparecer sin alarma.
- Dependencias de desarrollo con 2 críticos (`tinypool`): afectan a quien corre las pruebas en local o en CI, no al artefacto.
- La build avisa de que la convención `middleware` está obsoleta en Next 16. Hoy funciona; el día que se retire, el CSP con nonce dejaría de aplicarse. Hay que migrar a `proxy` y verificar en navegador que la cabecera sigue saliendo.

## Decisiones y ambigüedades

- **`zod` no se sube a 4.x.** El parche solo existe en la mayor 4 (`>=4.6.6`), que cambia la API y toca decenas de esquemas (`src/**/*.schemas.ts`, `sandbox/protocolo.ts`). Es una decisión de dependencias con revisión humana. A quién confirmar: responsable del portal.
- **Supuesto sobre F-05:** el motor sirve el documento con `Content-Type: application/pdf`. Confirmar con: responsable del motor (`GET /v1/workers/bank-statement/reviews/:id/document`). El arreglo no depende de ello.
- **Severidad de F-04 y F-05** es estimación mía, no un puntaje CVSS. Hoy ninguna ruta de API se arma entera con datos externos, así que F-04 es latente.
- **Secretos a rotar:** ninguno hallado. Sin valores enmascarados que reportar.
- No se hizo `git push`. El merge a `dev` exige revisión humana (CLAUDE.md): el flujo termina en abrir el PR.
