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
- **Ningún endpoint del motor puede quedar invisible sin que alguien lo decida
  por escrito** — `scripts/engine-surface.mjs`. Cada operación del OpenAPI del
  motor (`docs/superficie-motor.json`, versionado) está consumida por alguna
  vista o exenta en `docs/superficie-no-consumida.md` con motivo y responsable.
  Existe por un fallo medido: el motor publicaba desde hacía meses las cinco
  operaciones de `v1/model-monitoring` y las dos de `v1/data-subject-requests`, y
  **el portal no llamaba a ninguna**. Trabajo hecho, invisible, sin una sola
  prueba que pasara por ahí — así que tampoco se habría notado si se rompía.
  Regenerar el inventario: `node scripts/engine-surface.mjs --generar` (necesita
  el motor en `../AtlasDecisionEngine`); ver lo que falta:
  `node scripts/engine-surface.mjs --informe`.
  Dos trampas al escribir código que llama al motor:
  **escribe la ruta entera**, nunca interpolando el nombre de la operación
  (`` `/v1/model-monitoring/${análisis}` ``), porque el gate lee esa
  interpolación como un comodín de un segmento y daría por consumidas también las
  operaciones vecinas que nadie mira; y si construyes la ruta desde una constante
  o un ayudante, que el literal `/v1/…` esté en el mismo archivo, que es hasta
  donde el gate sabe seguir la pista.
- Gate completo: `yarn verify` (format:check, lint, verify:source, typecheck,
  test, build). Córrelo antes de dar por cerrado un cambio.
- E2E: `yarn test:e2e` corre contra el servidor de desarrollo;
  **`yarn test:e2e:prod` (tras `yarn build`) contra el artefacto que se
  despliega**, que es la corrida canónica y la que usa la CI — sin compilación al
  vuelo, un fallo significa siempre un defecto. `yarn test:e2e:tools` son los
  generadores de evidencia y huellas, que no afirman nada y van aparte.
  Para verificar la build SIN parar el servidor de desarrollo, compila a otro
  directorio: `NEXT_DIST_DIR=.next-audit yarn build` (ignorado por git). Ojo:
  Next añade solo el nuevo `distDir` a los `include` de `tsconfig.json` y lo
  reescribe con su propio formato, así que después hay que revertirlo
  (`git checkout -- tsconfig.json`) o `format:check` se pone rojo.
  **No corras `yarn build` a secas con el servidor de desarrollo levantado**: la build
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

#### Si el proveedor exige segundo factor

Para los actores internos el 2FA es OBLIGATORIO en cuanto el proveedor tiene
canal de correo, así que la contraseña sólo abre la pantalla del PIN. `entrar()`
(`e2e/support/real-portal.ts`) completa los dos pasos leyendo el correo de un
recolector local (`e2e/support/buzon-pin.ts`):

```bash
# 1. El proveedor manda el correo a un webhook en vez de a Gmail.
#    En AtlasBackend/.env:  NOTIFICATION_EMAIL_PROVIDER=webhook
#                           NOTIFICATION_EMAIL_WEBHOOK_URL=http://host.docker.internal:5199/correo
# 2. La batería levanta el recolector en ese puerto.
PW_PIN_INBOX_PORT=5199 PW_USER=<correo> PW_PASSWORD=<clave> \
  yarn playwright test e2e/portal-real-clasificador.spec.ts
```

**No apagues `AUTH_LOGIN_PIN_ENABLED` para que pasen.** Es la salida que parece
razonable y no lo es: la corrida queda verde habiendo ejercitado un camino de
acceso que no es el que corre en producción, y justo el tramo —login de dos
pasos, canje del desafío, emisión de la cookie tras el PIN— que más importa
comprobar. Sin `PW_PIN_INBOX_PORT`, si aparece la pantalla del PIN el andamiaje
falla diciendo exactamente qué falta, en vez de agotar el reloj.

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
yarn playwright test e2e/portal-real-identidad.spec.ts
yarn playwright test e2e/portal-real-qa-lab.spec.ts
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
- `-identidad` — la tercera pestaña de «Procesamiento»: verificar un documento
  contra una selfie por escenario Y **subiendo dos imágenes propias**, que es el
  único camino donde se ejercitan el `multipart/form-data`, los bytes mágicos y
  el techo de tamaño. Comprueba además que los otros dos workers siguen
  funcionando —comparten catálogo, mapeador de ejecuciones y métricas— y deja la
  evidencia en `docs/visual-evidence/identidad/`. **Los tres proveedores son
  reales y locales**: Tesseract lee el documento y `@vladmandic/human` detecta,
  compara 1:1 y prueba vida, todo sobre WebAssembly, sin credenciales, sin red y
  sin coste por verificación. Así que una imagen que no es un documento se
  rechaza de verdad, y un «VERIFICADO» afirma también que las dos caras son de la
  misma persona. El catálogo publica quién decidió cada cosa
  (`limits.ocrProvider`, `limits.faceProvider`, `limits.livenessProvider`) y el
  perfil de umbrales con el que se comparó. La selfie se puede subir **o tomar
  con la cámara del equipo**: el E2E la ejercita con la cámara falsa de Chromium,
  no con un doble.

  Dos cosas que la pantalla dice y conviene saber leer. El perfil
  `sintetico-…` avisa de que el corte se midió sobre rostros DIBUJADOS —no hay
  fotos de personas en el repositorio, a propósito— y no predice la tasa de error
  sobre caras reales; el motor lo rechaza en producción. Y la marca
  `GENERATED_INPUT_NO_LIVENESS` avisa de que la ejecución salió de un escenario:
  sobre una imagen que fabricó el motor la prueba de vida NO se ejecuta, porque
  una imagen fabricada no es una captura en vivo. La comparación biométrica de un
  escenario sí es real y completa.

- `-qa-lab` — que una corrida generativa LARGA sobrevive al techo de 15 s con que
  el motor corta cualquier petición (`REQUEST_TIMEOUT_MS`). Lanza 5000 casos con
  determinismo y concurrencia 1 —unos 40 s— y comprueba que pasado el techo la
  pantalla sigue enseñando avance y el contador ha crecido. **La configuración
  importa**: con la concurrencia de serie el motor despacha esos mismos casos en
  menos de diez segundos, la corrida vuelve a caber dentro del plazo y la prueba
  pasaría estuviera arreglado o no. Deja la evidencia en
  `docs/visual-evidence/qa-lab/`.

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

- **El acceso puede tener DOS pasos.** `POST /v1/session/login` devuelve una
  sesión **o** un desafío (`{ pinChallengeRequired, challengeToken,
expiresInMinutes }`), y ambos son un éxito: con segundo factor, la contraseña
  correcta todavía no autentica. `login()` de `useAuth()` devuelve el desenlace
  —no `void`— y sólo aplica sesión si la hubo; el PIN se canjea con
  `verifyLoginPin()` contra `/v1/session/login/pin`. Dar el desafío por sesión
  dejaba el portal creyéndose autenticado sin token.
- **`user.mfaEnabled` es el estado EFECTIVO del segundo factor**, no una casilla
  de la ficha. Para cuentas internas el proveedor informa si el login exige de
  verdad un factor más que la contraseña; antes publicaba una columna que nadie
  escribía nunca, así que `SessionSecurityNotice` avisaba «esta cuenta no tiene
  segundo factor» a todo el mundo, incluido quien acababa de teclear un PIN.
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
- **Los roles de una sesión son SUS DOS listas.** Nunca leas `user.roles` a
  secas: usa `useEffectiveRoles()` en componentes o `effectiveRoles(user)` en
  lógica pura (`src/auth/effective-roles.ts`). El IdP emite además `legacyRoles`,
  y una cuenta antigua puede llevar ahí toda su autorización. Sumarlas lo hacían
  sólo el guardia de ruta y el menú, así que quien entraba por un rol heredado
  veía la pantalla con todos los botones apagados y sin explicación. Lo aplica
  `verifyEffectiveRoles` en `scripts/verify-conventions.mjs`.
- **La caché de React Query se vacía al cambiar de sesión** (`AuthProvider`). El
  cliente vive por encima del layout y ninguna `queryKey` lleva tenant: sin ese
  borrado, quien entraba después en la misma pestaña veía los datos del anterior.
- **El contrato de sesión es estricto sólo en lo que se usa** (`auth.schemas.ts`).
  Un campo que el portal no lee no puede dejar fuera a toda la organización: se
  declara opcional con `.nullish().transform(...)`, no con `.default(...)` —en
  Zod 3 un valor por omisión NO cubre un `null` explícito—.
- `/metrics` exige `METRICS_SCRAPE_TOKEN`; sin él responde 404 a propósito. Las
  métricas del motor se raspan contra el motor, no publicándolas por el portal.
- **Hay DOS rutas al motor y no se mezclan.** El portal en Docker (5180) sale por
  `http://api:3000` dentro de la red **`atlas-decision-engine_atlas_app`** —el
  motor segmentó sus redes y su `_default` se quedó vacía—; el servidor de
  desarrollo del anfitrión (5173) sale por `http://127.0.0.1:3000`, que es el
  puerto que el motor publica. El valor del contenedor lo fija `docker-compose.yml`
  y su override se llama `FRONTEND_CONTAINER_ENGINE_URL` **a propósito**: cuando se
  llamaba igual que la del `.env`, el valor pensado para el anfitrión se colaba
  dentro del contenedor y toda la interfaz respondía 502 sin que nada lo explicara.
  Si tras reiniciar el motor el portal da 502, comprueba primero
  `docker inspect … --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'`
  en ambos contenedores: casi siempre es que ya no comparten red.
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
- **Tipografía por token**: `parts/typography.css` define la escala de tamaño
  (`--type-3xs` … `--type-3xl`) y de peso (`--weight-regular` … `--weight-black`).
  Ojo al nombre: los tamaños son `--type-*` porque `--text-*` ya significaba
  COLOR (`--text`, `--text-muted`). Había 491 `font-size` con **63 valores
  distintos** mezclando `px`, `rem` y `em` para decir lo mismo, y nueve pesos
  (650, 750, 850…). La escala va en `rem` para que respete el tamaño de letra
  configurado en el navegador —el mismo compromiso que el `layout` asume al no
  bloquear el zoom—; anclada a 16 px, cada escalón vale lo que valía en píxeles.
  Se permiten `em` (relativo al padre), `clamp()` (títulos fluidos) e `inherit`.
- **Interletraje por token, y NADA en versalitas espaciadas.** `--track-display`
  / `--track-tight` / `--track-normal` / `--track-label` (`typography.css`). La
  regla es la de cualquier tipografía bien ajustada: el texto grande se cierra,
  el pequeño se deja en paz. Había 70 declaraciones de `text-transform:
uppercase` —secciones del menú, cabeceras de tabla, etiquetas de campo,
  antecabeceras, insignias— casi todas con peso 800 y `letter-spacing: 0.1em`.
  Eso no se lee como jerarquía: ensancha cada rótulo un 25 %, empuja el dato que
  se viene a leer y convierte la interfaz en un impreso oficial. Quedan tres
  versalitas en todo el portal, y las tres son el LOGOTIPO. Si añades una,
  explica por qué ese texto es una marca y no un rótulo.
- **Escala de superficie**: `--radius-xs` 4 · `--sm` 8 · `--md` 12 · `--lg` 16 ·
  `--pill`, y `--space-1..7`. A más superficie, más radio: un panel va a `--lg`,
  una tarjeta a `--md`, un control a `--sm`. Había 150 radios a mano con 13
  valores distintos (paneles a 4 px con tarjetas a 8 dentro). No escribas
  `border-radius: 9px`.
- **El armazón vive en `parts/app-shell.css`** (barra lateral y superior), no en
  `foundation.css`. Se importa en el mismo punto de la cascada, así que
  `sidebar-drawer.css`, `auth-feedback.css` y el tema oscuro lo siguen afinando.
  La cabecera de la barra lateral y la barra superior miden lo mismo
  (`--shell-head`): la hairline que cruza la pantalla es UNA, no dos a distinta
  altura.
- **La fuente se sirve desde el propio origen.** `foundation.css` pedía `Inter`
  pero NADIE la cargaba —ni `next/font`, ni `@font-face`, ni `public/`—, así que
  el portal entero se pintaba con el respaldo del sistema (Segoe UI en Windows) y
  los sitios con `font-family: monospace` a pelo, con Courier New. La carga
  `next/font/google` en `app/layout.next.tsx` y la expone como `--font-sans`: se
  descarga al compilar y se sirve desde el mismo origen, así que la CSP
  (`font-src 'self' data:`) la admite sin abrirle la mano a Google ni filtrar la
  IP de quien usa el portal.
- **Adornos también por token** (`--scrollbar-thumb`, `--ring-accent`,
  `--ring-accent-line`, `--ring-info`, `--ring-success`, `--focus-ring`). La regla
  de color eximía a `shadow` y `scrollbar`, y por esa rendija se colaron nueve
  literales de tema CLARO que ningún `[data-theme='dark']` corregía: la cabecera
  anclada de las tablas dibujaba una línea gris clara a media tabla oscura y el
  pulgar de la barra de desplazamiento quedaba casi blanco sobre el panel oscuro.
  **La excepción ya no está**: sólo se eximen `gradient|mask|filter`, donde el
  color suele ser una parada de rampa o un `#000` que hace de opacidad. Las
  sombras de profundidad no se ven afectadas —usan `rgba()`, y el gate sólo
  persigue el hexadecimal—. Excepción real que queda: el galón de `select` es un
  `data:` URI y ahí dentro no entran ni `var()` ni `currentColor`, así que se
  escribe una vez por tema.
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
  `components/ambient/useAmbientState.ts`. Además: **sólo se mueve lo que
  responde a un gesto.** Se retiraron el barrido de luz cada 18 s, la deriva
  perpetua de la malla, y los saltos al pasar el cursor sobre paneles, tarjetas,
  filas de lista, botones y enlaces del menú. Un panel no es un control —no pasa
  nada al apuntarlo—, así que levantarlo promete una acción que no existe, y con
  seis en pantalla la página tiembla bajo el ratón. Lo que sí responde lo dice
  cambiando de superficie o de borde; el único desplazamiento que queda es el
  hundido al PULSAR, que confirma un hecho.
- **El color es señal, no decoración.** Los grises son neutros para que el único
  color de la pantalla sea el que significa algo. Un lavado de estado
  (`--warning-wash`, `--success-wash`) sólo se usa donde HAY ese estado: las dos
  tarjetas del explicador iban en ámbar y verde diciendo «atención» y «correcto»
  de forma permanente sobre un texto que sólo explica la pantalla. Si necesitas
  distinguir dos bloques que no son estados, hazlo con el icono y el rótulo.

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

| Ruta                           | Página                                | Roles                              |
| ------------------------------ | ------------------------------------- | ---------------------------------- |
| `/calculated-fields`           | `pages/CalculatedFieldsPage.tsx`      | `accessPolicies.calculatedFields`  |
| `/calculated-fields/[fieldId]` | `pages/CalculatedFieldDetailPage.tsx` | idem                               |
| `/libraries`                   | `pages/LibrariesPage.tsx`             | `accessPolicies.libraryRegistry`   |
| `/qa-lab`                      | `pages/QaLabPage.tsx`                 | `accessPolicies.qaLab`             |
| `/workers/audio-tts`           | `pages/AudioTtsWorkerPage.tsx`        | `accessPolicies.workers`           |
| `/workers/data-notebook`       | `features/data-notebook/`             | `accessPolicies.dataNotebook`      |
| `/decision-quality`            | `pages/DecisionQualityPage.tsx`       | `accessPolicies.decisionQuality`   |
| `/data-subject-requests`       | `pages/DataSubjectRequestsPage.tsx`   | `accessPolicies.dataSubjectRights` |
| `/risk-governance`             | `pages/RiskGovernancePage.tsx`        | `accessPolicies.riskGovernance`    |

Estilos nuevos: `styles/parts/contracts.css`, `calculated-fields.css`, `libraries-qa.css`,
`workers-audio.css`, `decision-quality.css`, `risk-governance.css` (solo tokens, nunca hex).

## Las tres pantallas de medición no son la misma, y el orden importa

Se parecen y responden a preguntas encadenadas. Confundirlas produce la lectura peligrosa: un
tablero de degradación en verde sobre un sistema de observación apagado.

1. **`/decision-quality` — ¿hay datos con los que medir?** Cobertura de sujeto y de desenlace,
   cola de ventanas vencidas, cosechas. Es la pregunta ANTERIOR a todas.
2. **`/model-monitoring` — ¿el modelo se degrada?** Desempeño, estabilidad de población, impacto
   adverso. Sólo significa algo si (1) está en verde.
3. **`/risk-governance` — ¿bajo qué condiciones se le deja operar?** Apetito de cartera,
   calibración, licitud vigente, reidentificación y expediente del modelo. Ninguna decide; todas
   condicionan.

Reglas de presentación que las tres comparten, y el motivo:

- **`null` no es `0`.** Una medida que no se pudo tomar sale como «—» y en tono neutro. Pintar de
  rojo un sistema que simplemente no decidió esta semana produce una alarma falsa, y las alarmas
  falsas se desactivan a mano — con lo que la próxima vez que sea de verdad, nadie mirará.
- **El denominador siempre a la vista.** Un 100 % sobre tres decisiones y un 100 % sobre veinte
  mil son idénticos si sólo se manda el porcentaje.
- **La intensidad se atenúa con la muestra** (matriz de cosechas). Sin eso, la celda más chillona
  es siempre la cosecha más nueva —tres créditos, uno malo, 33 %— y se lee como que la política de
  este mes es un desastre cuando lo único que hay es poca muestra.
- **Un control se enseña distinto según si BLOQUEA o sólo mide** (límites de cartera). Verlos
  iguales hace creer que la cartera está protegida cuando lo único que hay es un número guardado.

## Calidad de la decisión (`/decision-quality`)

Responde la pregunta ANTERIOR a la del monitoreo del modelo: aquél mide si el modelo se
degrada, ésta si hay datos con los que medirlo. Un tablero de degradación en verde sobre un
sistema de observación apagado es la lectura peligrosa que esta vista existe para impedir.

- **Los dos ratios se pintan siempre con su denominador.** Un 100 % sobre tres decisiones y un
  100 % sobre veinte mil son visualmente idénticos si sólo se manda el porcentaje.
- **`null` no es `0`.** Una cobertura que no se pudo medir sale como «—» y en tono neutro
  (`coverageTone`). Pintar de rojo un sistema que simplemente no decidió esta semana produce una
  alarma falsa, y las alarmas falsas se desactivan a mano — con lo que la próxima vez que el
  indicador se ponga rojo de verdad, nadie mirará.
- **La cola de ventanas vencidas es el producto principal**, no la carga. Convierte «faltan
  desenlaces» en una lista con nombres ordenada por antigüedad. Que esté completa a la vista es
  también lo que hace lícito el registro manual: sobre una lista donde está todo no se puede
  elegir qué cargar y qué no, así que no aparece el sesgo de «lo que alguien se acordó de
  cargar». `INDETERMINATE` es una opción de primera clase por lo mismo: distingue el caso mirado
  del olvidado.
- **La carga por lote valida antes de escribir, y el botón de escribir está apagado hasta
  entonces.** Descubrir en la fila 4000 que una referencia no existía, con 3999 ya escritas
  sobre evidencia regulatoria, obliga a un borrado manual sobre la tabla que justamente no se
  debe borrar a mano.
- **La matriz de cosechas usa escala secuencial** —«tasa de mora» no tiene punto medio neutro—
  y **atenúa la intensidad con el número de observaciones**: sin eso, la celda más chillona
  sería siempre la cosecha más nueva (tres créditos, uno malo, 33 %) y se leería como que la
  política de este mes es un desastre cuando lo único que hay es poca muestra.

## El cuaderno de datos no ejecuta nada en el servidor

`/workers/data-notebook` está en «Procesamiento» junto a los workers, pero no es uno: no lee del
motor, no tiene catálogo ni cola, y por eso su pestaña sólo tiene consola y ningún panel —un panel
siempre en verde sobre algo que no se mide se lee como una comprobación hecha—.

- **El reparto es la decisión, y de ella sale todo lo demás.** Los DATOS los sirve AtlasBackend
  (`/api/v1/data-notebook`, sobre las siete vistas de `read_api`), acotados por inquilino y con la
  PII enmascarada. El CÓDIGO corre en la pestaña de quien lo escribe. **No hay ni un endpoint que
  reciba Python o JavaScript**, así que abrir un cuaderno de análisis no le añade al backend una
  superficie de ejecución remota — que es el riesgo que suele traer una herramienta con esta forma.
- **Segundo destino del portal.** `/atlas-backend/*` (`src/server/atlas-backend-proxy.ts`) sale
  hacia `ATLAS_BACKEND_URL`. NO se escribe con el prefijo `/v1/*`: ése es del motor y
  `scripts/engine-surface.mjs` lee esos literales para decidir qué operaciones están consumidas, de
  modo que una ruta de AtlasBackend con ese prefijo daría por cubierta una operación que nadie
  llama. La credencial es la misma: el token lo emite AtlasBackend y el motor lo reenvía tal cual.
- **Python es CPython real sobre WebAssembly** (Pyodide, con pandas y numpy), servido desde
  `/pyodide/` del propio origen. Lo trae `node scripts/setup-pyodide.mjs` (~21 MB, en `.gitignore`:
  artefacto reproducible, no fuente) resolviendo el cierre de dependencias desde el propio
  `pyodide-lock.json` — traer pandas sin `python-dateutil` deja un `ModuleNotFound` dentro del
  intérprete, ya en el navegador y sin pista de qué falta. Sin el artefacto, la pestaña de
  JavaScript funciona igual y la de Python dice el comando exacto que lo arregla.
- **La CSP suma `'wasm-unsafe-eval'`, y sólo eso.** No es `'unsafe-eval'` ni se le parece: aquél
  reabriría `eval()` y `new Function()` para TODO el portal. El JavaScript de las celdas no
  necesita ninguno de los dos: se carga como worker desde un `blob:` (`worker-src 'self' blob:`),
  que es cargar un script y no generarlo en caliente.
- **Corre los E2E contra la BUILD** (`PW_BASE_URL=http://localhost:5188`, tras `next start`). En
  desarrollo la CSP añade `'unsafe-eval'` y taparía justo el fallo que `e2e/data-notebook-python.spec.ts`
  existe para detectar.
- **Dos cosas que la pantalla dice porque cambian lo que significan las conclusiones**: cuántas
  filas se cargaron —analizar 100 creyendo que son el universo da un número correcto sobre una
  muestra que nadie eligió— y qué columnas viajan enmascaradas, rotulado EN la cabecera de cada
  columna y no en un aviso general: agrupar por una columna enmascarada junta a personas distintas
  bajo la misma máscara y el recuento sale mal sin que nada falle. Cambiar de dataset o de página
  descarta los resultados por lo mismo.

## El worker de locución no se parece a los otros tres

`/workers/audio-tts` es **cache-first y de pago**, y las dos cosas cambian la pantalla:

- **No hay cuadro de texto libre.** Lo que se puede decir con la voz de una organización lo
  fija su catálogo de plantillas (`GET /v1/workers/audio-tts/templates`), y la consola pide
  las variables que cada plantilla declara. Un cuadro abierto convertiría a cualquiera con
  permiso en alguien capaz de poner cualquier frase en boca de la marca —y de gastar el
  presupuesto del mes escribiendo—.
- **Hay CUATRO desenlaces, no dos** (`audio-types.ts`): `READY` (salió de la caché, no
  costó), `QUEUED` (se generó ahora), `FALLBACK` (sonó el respaldo, no lo que se pidió) y
  `UNAVAILABLE` (no hay audio ni respaldo). Los dos últimos van en ámbar y **no** en rojo:
  el contrato del worker es que la falta de audio nunca rompe a quien lo pide. Colapsarlos
  con «Completado» esconde justo lo que hay que mirar.
- **El audio se pide por la puerta autenticada** (`downloadAudio`) y se reproduce como blob.
  Apuntar un `<audio src="/v1/…">` al motor deja el reproductor mudo con un 401: cargar un
  medio es una navegación del navegador y ahí no viaja el `Authorization`.
- **El texto locutado no se publica.** Vive cifrado en la caché del motor porque lleva
  dentro las variables —el nombre de una persona—. Lo que sí se enseña es la identidad del
  audio: voz, versión de voz, modelo, formato y huella. La versión importa: sin ella, dos
  locuciones hechas con voces distintas parecen la misma.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
