> **AVANCE: 2 / 2 microtareas definidas de H4 (Motor de decisión) — 100 %, con un alcance deliberadamente reducido: solo se hizo instalable el portal y se documentaron tres hallazgos. NO se rediseñó su móvil.** Con esto las 4 franjas (H1–H4) tienen plan, evidencia y reporte; el rediseño completo de ATLAS NO está terminado (ver los «Pendiente» de cada repo).

- Fecha: 2026-10-28 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/great-shannon-fm2l7p` (AtlasDecisionEngineFrontend)
- Peldaño de evidencia alcanzado: `TESTED` (`yarn verify` exit 0: 220 archivos, 1679 pruebas, build). El manifiesto se comprobó con `curl` contra el servidor de desarrollo, sin sesión. Las capturas son contra el motor simulado del propio E2E; no se declara `VERIFIED`.

## Completado

| ID       | Qué se logró                                                                                                                   | Comando de verificación                 | Resultado                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | -------------------------------------------------- |
| H4.S1.M1 | Manifiesto PWA estático (`public/manifest.webmanifest`) declarado en los `metadata` del layout; iconos 192/512 que ya existían | `curl` del manifiesto sin sesión        | PASS · HTTP 200 `application/manifest+json`        |
| H4.S2.M1 | Línea base a 375/768/1280 con el motor simulado del repo y hallazgos 3–5 documentados                                          | spec de captura (scratchpad) + métricas | PASS · `evidencia/base/` y `evidencia/salidas.txt` |

`yarn -s verify` (formato, lint, `verify:source`, `verify:help`, typecheck, 1679 pruebas, build) → exit 0.

## A medias

Ninguna.

## Pendiente (hallazgos medidos, NO atacados — decisión tuya)

| #   | Hallazgo medido a 375 px                                                                                                                                                      | Por qué no se tocó                                                                                                                                                                              | Qué lo destraba                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | La cabecera lleva **7 controles** (menú, buscar, acción rápida, tutoriales, tema, notificaciones, perfil); los otros tres portales quedaron en 3–5                            | Ni «Tutoriales» ni «Tema» tienen otro acceso, y los recorridos guiados los usan como anclas (`data-tutorial-id`)                                                                                | Decidir si se mueven al menú de usuario en `≤560 px` y revisar los recorridos                                                         |
| 4   | **Primer uso**: la primera pantalla de `/platform-health` es solo aviso de sesión + explicador abierto + invitación al recorrido; no hay contenido de la página sin desplazar | Es estado de primer uso (la invitación aparece una vez y el explicador recuerda lo plegado); cambiar su valor inicial por ancho arriesga un desajuste de hidratación que su propio código evita | Decidir si en móvil el explicador nace plegado (requiere resolverlo tras montar) o si la invitación y el explicador no deben apilarse |
| 5   | En `/executions` el identificador (la clave de la fila) se **trunca** («REQ-10-0000-…») hasta no distinguir filas                                                             | No se leyó el componente de la tabla; es un portal con reglas propias estrictas                                                                                                                 | Medir con identificadores reales y decidir si la columna cede ancho a las demás                                                       |

## Evidencia

- `evidencia/base/`: `m375_platform-health.png`, `m375_cajon.png`, `m375_executions_pagina-completa.png`.
- `evidencia/salidas.txt`: comandos y salidas literales (recortadas), incluido el intento descartado.
- Datos: motor simulado `denseBackend` del repo (identidades sintéticas «E2E»); sin datos reales.

## No cubierto

- **No hay capturas «después»**: lo único que cambió es el manifiesto (sin efecto visual). El resto es línea base.
- **Motor real**: nunca se ejercitó.
- **Dispositivos reales**: solo emulación de Chromium; la instalación como app (`beforeinstallprompt`, «Añadir a pantalla de inicio») **no se probó** en ningún navegador; solo se comprobó que el manifiesto y sus iconos responden 200.
- **Tema oscuro**: no se midió; el manifiesto usa los colores del tema claro.
- **Rutas**: solo `/platform-health`, `/variables`, `/executions` y `/algorithms`. No se midieron el editor de grafos, el cuaderno de datos, las consolas de workers ni `/search`.
- **E2E de Playwright del repo**: no se ejecutaron (requieren servidor y credenciales); sí `yarn verify`.

## Desvíos del plan

- El plan decía `src/app/manifest.next.ts`. **No funcionó**: por `pageExtensions` Next enlazó `/manifest.next` y respondió 500. Se retiró y se sustituyó por un archivo estático en `public/` + `manifest` en los `metadata`. El plan quedó corregido.
- El conteo «sub44» de mi spec incluyó entradas del cajón que están fuera de pantalla; se descartó como métrica (no se cita en los hallazgos).

## Riesgos residuales

- El manifiesto es estático: si cambian los iconos o el nombre del producto hay que editar `public/manifest.webmanifest` a mano.
- `theme_color` es el del tema claro; con el interruptor en oscuro, la barra del sistema de una app instalada no seguiría el cambio.
- `next-env.d.ts` lo reescribe `next dev` (rutas de `.next/dev`); se restauró con `git checkout` antes de cerrar y no entra en este cambio.

## Decisiones y ambigüedades

- **Alcance reducido a propósito**: este portal ya tiene un sistema responsive propio y medido, y un cajón profundo por grupos, así que no se le impuso la barra inferior de los otros tres. A confirmar contigo si quieres que se ataquen los hallazgos 3–5.
- Entorno: `yarn install` necesitó `--ignore-engines`; Playwright se lanzó con el Chromium preinstalado (`executablePath`) porque el repo fija otra versión que no tiene su navegador descargado; no se ejecutó `playwright install`.
