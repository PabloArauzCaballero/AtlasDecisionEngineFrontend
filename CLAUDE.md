# ATLAS Decision Engine Frontend

Portal Next.js 16 (App Router, React 19) para gobernar artefactos de decisión:
autoría de grafos, pruebas, aprobaciones, simulación y auditoría.

## Comprender la estructura: usa graphify-out primero

Antes de explorar el código a ciegas, lee el grafo de estructura generado por
`graphify` en `graphify-out/`:

- `graphify-out/GRAPH_REPORT.md` — resumen navegable: hubs por comunidad,
  abstracciones núcleo (god nodes como `display()`, `apiRequest()`,
  `useNotifications()`) y conexiones no obvias. **Empieza aquí.**
- `graphify-out/graph.json` — grafo completo (nodos/aristas) para rastrear
  dependencias exactas de un símbolo o archivo.
- `graphify-out/manifest.json` — índice por archivo.
- `graphify-out/graph.html` — visualización interactiva (para humanos).

### Frescura del grafo

`GRAPH_REPORT.md` indica el commit desde el que se construyó. Compáralo con
`git rev-parse HEAD`; si difieren o hay cambios sin commitear, considera el
grafo orientativo y verifica en el código real antes de afirmar dependencias.

### Mantenerlo actualizado

Un hook `Stop` en `.claude/settings.json` ejecuta `graphify update .` en
segundo plano al final de cada turno con cambios, así que normalmente el grafo
se mantiene al día solo. Si necesitas frescura inmediata dentro de un turno
(p. ej. tras crear varios módulos y antes de razonar sobre ellos), ejecuta
`graphify update .` manualmente (~40 s, sin costo de API).

## Reglas del repositorio (las aplica `yarn verify`)

- Máximo 299 líneas por archivo fuente (incluye CSS) — `scripts/verify-source.mjs`.
- Todo HTTP pasa por `src/api/http-client.ts`; `fetch()` directo está prohibido.
- **Toda ruta de `(portal)` necesita su patrón en `src/auth/route-access.ts`.** La
  lista se deriva del árbol de páginas (`scripts/verify-conventions.mjs`), no de
  un inventario a mano: una vista sin regla no da error de permisos, desaparece.
- **Todo `var(--token)` sin respaldo debe existir.** Si no, el navegador descarta
  la declaración entera y el estilo no se aplica sin avisar. Mismo script.
- **Ningún color escrito a mano fuera de `theme.css`.** Sólo se admiten la
  identidad por tipo (`--node-color`) y los adornos (degradados, máscaras,
  sombras). Mismo script.
- Gate completo: `yarn verify` (format:check, lint, verify:source, typecheck,
  test, build). Córrelo antes de dar por cerrado un cambio.
- E2E: `yarn test:e2e` corre contra el servidor de desarrollo;
  **`yarn test:e2e:prod` (tras `yarn build`) contra el artefacto que se
  despliega**, que es la corrida canónica y la que usa la CI — sin compilación al
  vuelo, un fallo significa siempre un defecto. `yarn test:e2e:tools` son los
  generadores de evidencia y huellas, que no afirman nada y van aparte.
  **No corras `yarn build` con el servidor de desarrollo levantado**: la build
  reescribe `.next` y el servidor en marcha se queda con módulos que ya no
  existen (rutas dando 404, «module factory is not available»). Se cura parando
  el servidor, borrando `.next` y arrancando de nuevo.
- Para probar algo que sólo se ve con datos, usa `e2e/support/dense-backend.ts`:
  el motor simulado normal devuelve listados VACÍOS, así que una prueba escrita
  contra él mide cabeceras y estados vacíos creyendo que mide la vista entera.

### Contra el motor REAL, con sesión real (`e2e/portal-real-*.spec.ts`)

Opt-in. Entran por la pantalla de acceso con un usuario del proveedor de
identidad y recorren el portal con los datos que hay en la base. Un simulado
prueba que la vista sabe pintar la forma que este repositorio CREE que el motor
sirve; esto prueba que esa creencia es cierta.

```bash
PW_BASE_URL=http://localhost:5180 PW_TENANT_ID=1 \
  PW_USER=<correo> PW_PASSWORD=<clave> \
  yarn playwright test e2e/portal-real-clasificador.spec.ts
```

Sin `PW_USER`/`PW_PASSWORD` se saltan enteras: una prueba roja por falta de
configuración no informa de ningún defecto. **Las credenciales nunca se
escriben en el repositorio.**

**Córrelos de UNO EN UNO.** No es una preferencia: `-barrido` recorre decenas de
vistas y agota el limitador del motor (`RATE_LIMIT_MANAGEMENT_REQUESTS`,
300/min). Encadenados en una sola invocación, el que va detrás recibe 429 en el
catálogo del worker, la vista lo lee como «worker apagado» y las pruebas se
SALTAN — en verde y sin comprobar nada. Medido: juntos, 146 peticiones
rechazadas; separados, ninguna que importe.

```bash
# uno por invocación, y deja respirar un minuto entre ellos
yarn playwright test e2e/portal-real-acceso.spec.ts
yarn playwright test e2e/portal-real-clasificador.spec.ts
yarn playwright test e2e/portal-real-generadores.spec.ts
yarn playwright test e2e/portal-real-barrido.spec.ts
```

- `-acceso` — la puerta: validación en cliente, credencial mala, tenant que no
  existe. Fija que **un tenant inexistente responde 401 igual que una contraseña
  mala**: el motor lo mandaba a 502, que operativamente significa «proveedor de
  identidad caído» y además delataba qué tenants existen.
- `-clasificador` — clasificar un gasto real contra el transformer y ver su rama
  del árbol; la abstención; los límites del formulario.
- `-generadores` — que QA Lab y el simulador produzcan valores utilizables, no
  «undefined» ni «[object Object]».
- `-barrido` — todas las rutas, todos los controles con nombre accesible, y que
  cada diálogo atrape el foco y cierre con Escape. Los identificadores de las
  rutas de detalle **se descubren navegando**, no se fijan a `/1`: contra la base
  real ese identificador casi nunca existe y el barrido medía pantallas de «no
  encontrado» creyendo que medía vistas de detalle.

### Evidencia responsive con datos reales

```bash
PW_BASE_URL=http://localhost:5180 PW_TENANT_ID=1   PW_USER=<correo> PW_PASSWORD=<clave>   yarn evidencia:responsive          # genera y audita (~25 min)
yarn evidencia:responsive:auditar    # sólo revisa lo que ya hay en disco
```

Recorre la matriz completa (43 rutas × 10 anchos) y deja capturas y medición en
`docs/visual-evidence/real/`, que **está en `.gitignore`**: son 440 PNG y ~124 MB
por corrida, un artefacto que se regenera con el script. Las capturas curadas a
mano de `docs/visual-evidence/` sí se versionan — ésas son documentación.

**El script audita lo que quedó en disco, y esa parte no es ceremonia.** Una
corrida de Playwright puede terminar en verde y dejar 440 fotos de un spinner: la
evidencia salía de la pantalla «Validando sesión segura» porque la espera miraba
si el indicador de carga había DESAPARECIDO, y `PortalSessionGuard` lo monta
después del primer render — «no está» y «todavía no está» son indistinguibles.
Lo descubrió una persona abriendo los PNG, que es justo lo que una herramienta de
evidencia no puede permitirse. Hoy hay tres guardas: `esperarVista` aguarda una
señal POSITIVA (`.sidebar` o `.login-page`, que no pueden existir antes de
tiempo), la prueba se niega a capturar una vista sin asentar, y el script rechaza
la corrida si alguna captura pesa menos que una pantalla en blanco.

Los botones destructivos (borrar, aprobar, promover, desplegar) **no se pulsan**
y el barrido informa de cuáles omitió: un tope silencioso se leería como «se
probó todo».

## Convenciones clave

- Notificaciones: `useNotifications()` — los errores de mutaciones se reportan
  globalmente vía `MutationCache` en `src/app/QueryProvider.tsx`; las páginas
  solo añaden toasts de éxito.
- Diálogos: todo lo que declare `role="dialog"` + `aria-modal="true"` usa
  `useDialogFocus()` (`src/hooks/useDialogFocus.ts`), que lleva el foco dentro,
  lo atrapa y lo devuelve al cerrar. Un overlay que exija pulsar la página de
  detrás (los recorridos guiados) NO lleva `aria-modal`: sería mentira.
- Seguridad de cabeceras: la CSP con nonce por petición la emite
  `src/middleware.next.ts` (se llama así por el `pageExtensions` del proyecto;
  con el nombre `middleware.ts` Next NO lo carga). El resto de cabeceras están
  en `next.config.ts`.
- Navegación con feedback: usa `NavLink` (`src/navigation/NavLink.tsx`), no
  `next/link` directo, para alimentar la barra de progreso de rutas.
- Rutas nuevas: registra el patrón en `src/auth/route-access.ts` — las rutas
  desconocidas se deniegan por defecto.
- Editores de nodos del grafo: `src/features/graph-editor/NodeProperties.tsx`
  despacha un editor dedicado por tipo de nodo; los nodos de código comparten
  el contrato `config.script = { language, source }` y `script-lint.ts`.
- **Importar código no estrena variables.** El `@atlas-contract` sólo puede usar
  códigos que ya existan en el catálogo (mismo tipo) y motivos del catálogo de
  motivos, igual que cualquier artefacto: el motor responde
  `CODE_IMPORT_VARIABLE_NOT_IN_CATALOG` y `src/features/code-import/` lo repite
  en español, con la línea del contrato. Esos avisos **no** esconden la vista
  previa del grafo —para declarar bien una variable hay que ver qué pide el
  algoritmo—, sólo bloquean el guardado. Por eso `sample-source.ts` y
  `docs/algoritmo-python-listo.py` usan códigos reales del catálogo sembrado
  (`monthly_income`, `bureau_score`, `credit_risk_decision`…): un ejemplo con
  nombres inventados abriría la pantalla llena de errores.

## Sistema visual

- **Colores por token**: `src/styles/parts/theme.css` define el mismo juego de
  nombres (`--surface`, `--text`, `--line`, `--danger-wash`…) para claro y
  oscuro. En hojas nuevas usa tokens, no hex: un color escrito a mano queda
  ilegible al conmutar el tema y obliga a parchearlo en `theme-dark-*.css`.
- **Espaciado, radios y monoespaciada** (`--space-*`, `--radius-*`, `--font-mono`)
  y los alias semánticos (`--text-muted`, `--surface-muted`, `--danger-text`…)
  viven en `parts/foundation.css`, no en `theme.css`: no dependen de la luz.
- **Contraste**: `src/theme/theme-contrast.test.ts` mide cada token de texto
  sobre cada superficie y exige AA (4,5:1); `e2e/contrast.spec.ts` mide lo mismo
  sobre el DOM ya pintado, en 24 rutas y en **los dos temas**. Aclarar un gris
  rompe el gate. Si migras un color a token, migra la pareja entera (letra Y
  fondo): dejar una mitad literal es peor que dejar las dos.
- **Tema**: lo resuelve un script en línea del `layout` antes del primer pintado
  y lo conmuta `src/theme/ThemeToggle.tsx`. Las reglas oscuras van todas
  acotadas a `[data-theme='dark']`; `src/theme/theme.test.tsx` lo verifica.
- **Iconos**: `components/concept-icons.ts` (conceptos del dominio) y
  `components/action-catalog.ts` (acciones). Un concepto se dibuja siempre con
  el mismo icono; no crees uno nuevo sin añadirlo al catálogo.
- **Nodos del grafo**: `features/graph-editor/node-catalog.ts` es la única
  verdad de icono, forma, trama y explicación por tipo. El grafo debe leerse sin
  color.
- **Movimiento**: duraciones y curvas en `styles/motion-tokens.ts` (espejo de
  `parts/motion.css`, con prueba de sincronía). Nada debe animarse si el backend
  no está haciendo algo de verdad: el fondo ambiental se alimenta de
  `components/ambient/useAmbientState.ts`.

## Contratos en el editor (§1–§4 de la ampliación)

- `src/contracts/` — espejo del catálogo de tipos y de las restricciones del backend.
  Sirve para pintar selectores y dar feedback inmediato; **no es autoritativo**, el
  backend revalida siempre. `contracts.test.ts` fija la equivalencia.
- Editor de restricciones: `features/graph-editor/ConstraintEditor.tsx` (solo muestra las
  restricciones que aplican al tipo, y permite probar un valor).
- Variables intermedias: `features/graph-editor/IntermediateVariableManager.tsx`.
  Se declaran junto al grafo que las crea, nunca en el catálogo de variables.
- Contrato de salida: `features/graph-editor/OutputContractPanel.tsx`.
- Estado por nodo (§3.1): `features/graph-editor/NodeVariableStatePanel.tsx`, usado en
  el detalle de ejecución. Enmascara los datos sensibles también en cliente.

## Vistas nuevas

| Ruta                           | Página                                | Roles                             |
| ------------------------------ | ------------------------------------- | --------------------------------- |
| `/calculated-fields`           | `pages/CalculatedFieldsPage.tsx`      | `accessPolicies.calculatedFields` |
| `/calculated-fields/[fieldId]` | `pages/CalculatedFieldDetailPage.tsx` | idem                              |
| `/libraries`                   | `pages/LibrariesPage.tsx`             | `accessPolicies.libraryRegistry`  |
| `/qa-lab`                      | `pages/QaLabPage.tsx`                 | `accessPolicies.qaLab`            |

Estilos nuevos: `styles/parts/contracts.css`, `calculated-fields.css`, `libraries-qa.css`
(solo tokens, nunca hex).
