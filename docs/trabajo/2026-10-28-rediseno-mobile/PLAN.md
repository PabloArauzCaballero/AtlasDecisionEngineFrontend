# Plan — Motor de decisión: móvil, con la mano ligera

- Fecha: 2026-10-28 · Repos afectados: AtlasDecisionEngineFrontend (rama `claude/great-shannon-fm2l7p`) · Predecesores: `AtlasAdminPortal` (H1), `AtlasERPFrontend` (H2), `AtlasDashboardsFrontend` (H3), todos en `docs/trabajo/2026-10-28-rediseno-mobile/`
- Resultado observable: el portal se puede instalar en la pantalla de inicio del teléfono, y los hallazgos medidos a 375 px quedan documentados con evidencia para decidir cuáles se atacan.
- Kill-test: `curl /manifest.webmanifest` sin sesión devuelve algo distinto de 200 con un JSON de manifiesto.

## Por qué este portal recibe menos cambios que los otros tres

Decisión registrada: **este portal ya tiene un sistema responsive propio y medido** (`docs/RESPONSIVE_DESIGN_SYSTEM.md`, `RESPONSIVE_IMPLEMENTATION_REPORT.md`, cuatro puntos de corte con prueba, `--tap-min`, áreas seguras, degradado en tablas, auditoría `responsive-audit`), y su cajón está organizado por grupos (Diseño, Calidad, Gobierno, Operación, Auditoría) y es demasiado profundo para una barra inferior fija. Imponer el patrón de los otros tres portales no tiene un motivo medido. Se hace solo lo que es coherente y de bajo riesgo, y el resto se deja como hallazgo.

## Alcance

- IN: manifiesto PWA; línea base medida a 375/768/1280 con el motor simulado del propio E2E (`denseBackend`); documentar hallazgos.
- OUT: barra inferior, mover controles de la cabecera, tocar el explicador o la invitación al recorrido, tablas, backend, service worker, `theme-color` (el portal tiene tema claro/oscuro propio por interruptor y la meta no puede seguirlo sin un script), commit de otros repos.
- Reglas del repo que se respetan: archivos `*.next.ts(x)` para rutas (`pageExtensions`), máximo 299 líneas, `yarn verify`, sin colores literales fuera de `theme.css`.
- Ambigüedades registradas:
  - ¿La cabecera de 7 controles (menú, buscar, acción rápida, tutoriales, tema, notificaciones, perfil) justifica moverlos? Ni «Tutoriales» ni «Tema» tienen otro acceso y los recorridos guiados los usan como anclas. A confirmar con quien mantiene los tutoriales.

## Línea base medida (375×812, `denseBackend` del repo — NO es el motor real)

Evidencia: `evidencia/base/`.

| #   | Hallazgo                                                                                                                                                                  | Estado                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | `viewportFit: 'cover'` y `userScalable: true` ya están; el desborde horizontal es 0 en las 5 rutas medidas                                                                | Ya resuelto en origen                         |
| 2   | No hay manifiesto: no se puede instalar                                                                                                                                   | **Se arregla (H4.S1)**                        |
| 3   | La cabecera lleva 7 controles a 375 px; el resto de portales quedaron en 3–5                                                                                              | Hallazgo, sin tocar                           |
| 4   | Primer uso: la primera pantalla de `/platform-health` es solo aviso de sesión + explicador abierto + invitación al recorrido; no hay contenido de la página sin desplazar | Hallazgo, sin tocar (es estado de primer uso) |
| 5   | En `/executions` el identificador (la clave de la fila) se trunca («REQ-10-0000-…») y deja de distinguir filas                                                            | Hallazgo, sin tocar                           |

## H4 — Motor de decisión instalable y con hallazgos medidos

**CA:** Dado el portal, cuando se pide `/manifest.webmanifest` sin sesión, entonces responde 200 con un manifiesto válido que enlaza los iconos 192/512 que ya existen; y los hallazgos 3–5 quedan escritos con evidencia.
**DoD:** `yarn verify` exit 0 · `curl` del manifiesto · `REPORTE.md` con los hallazgos.
**Estado:** HECHO (alcance deliberadamente reducido; ver «Por qué este portal recibe menos cambios»)

### H4.S1 — Manifiesto PWA

| ID       | Microtarea                                                                                                            | CA (binario)                              | DoD (comando de verificación)                      | Estado |
| -------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------- | ------ |
| H4.S1.M1 | `public/manifest.webmanifest` + `manifest` en los metadata del layout (se descartó `manifest.next.ts`: respondía 500) | `/manifest.webmanifest` 200 y JSON válido | `curl -w "%{http_code}"` + `<link rel="manifest">` | HECHO  |

### H4.S2 — Hallazgos

| ID       | Microtarea                                              | CA (binario)                               | DoD                              | Estado |
| -------- | ------------------------------------------------------- | ------------------------------------------ | -------------------------------- | ------ |
| H4.S2.M1 | Línea base a 375/768/1280 y hallazgos 3–5 en el reporte | Cada hallazgo con captura o métrica citada | `evidencia/base/` + `REPORTE.md` | HECHO  |

## Riesgos y bloqueos previstos

| Riesgo                                                       | Impacto                                        | Mitigación                                           |
| ------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| `pageExtensions` solo admite `*.next.ts(x)`                  | Un `manifest.ts` no se cargaría                | Nombre `manifest.next.ts` y comprobar con `curl`     |
| El middleware (CSP, sesión) podría interceptar el manifiesto | El manifiesto exigiría sesión                  | Comprobar sin cookie                                 |
| El motor simulado no es el motor real                        | Las capturas prueban layout, no comportamiento | Etiquetar; peldaño máximo `VERIFIED_FUNCTIONAL_ONLY` |
