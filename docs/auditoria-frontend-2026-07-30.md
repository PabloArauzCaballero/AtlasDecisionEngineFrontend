# Auditoría integral del frontend — 30 de julio de 2026

Punto de partida: `yarn verify` en verde (typecheck, lint, verify:source, 387
pruebas) y la barrida de errores de runtime en Playwright sin incidencias. Es
decir, todo lo que el proyecto ya sabía comprobar estaba bien; la auditoría fue a
buscar lo que **ningún control existente miraba**.

Cada hallazgo se corrigió y se acompañó de una prueba que falla sin el arreglo.

---

## Fase 1 — Seguridad

### 1.1 No había Content-Security-Policy · CORREGIDO

El portal enviaba `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`,
pero ninguna CSP. Sin ella, cualquier HTML ajeno que se colara en una vista se
ejecuta sin obstáculo — y este portal pinta datos que vienen del motor.

Se añadió `src/middleware.next.ts`: emite una CSP con **nonce distinto por
petición**, con `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` y
`frame-ancestors 'none'`.

Dos detalles que costaron un ciclo de build cada uno y quedan documentados:

- Con el `pageExtensions` del proyecto (`['next.tsx','next.ts']`), Next **no
  carga** `middleware.ts`. El archivo tiene que llamarse `middleware.next.ts`.
  Se verificó leyendo `middleware-manifest.json` del build.
- El `<script>` del tema necesita `suppressHydrationWarning`. El navegador vacía
  el atributo `nonce` del DOM por seguridad en cuanto carga, así que React
  compara el nonce del HTML contra una cadena vacía y lo denuncia. La barrida
  e2e cazó exactamente esto (5 de 5 pruebas en rojo) antes del arreglo.

Prueba: `src/middleware.test.ts` (nonce irrepetible + directivas). Verificado
además contra el servidor real y con la barrida e2e completa.

### 1.2 El proxy dejaba falsificar la IP de origen · CORREGIDO

`proxyDecisionEngine` reenviaba al motor todas las cabeceras del navegador,
incluidas `x-forwarded-for`, `x-real-ip`, `forwarded`, `true-client-ip` y
`cf-connecting-ip`. Cualquiera podía elegir con qué IP quedaba registrado en la
auditoría del motor, y de paso saltarse listas por IP y límites de frecuencia.
En un portal cuyo producto **es** el rastro de auditoría, eso importa.

Ahora se descartan todas y se vuelven a declarar sólo las que el proxy puede
acreditar. La cadena real del cliente se conserva únicamente si el despliegue
declara `TRUSTED_PROXY=true` (documentado en `.env.example`): sin un proxy de
confianza delante, es preferible que el motor no sepa la IP a que registre una
inventada.

Pruebas: dos casos nuevos en `src/server/decision-engine-proxy.test.ts`.

### 1.3 Sin HSTS · CORREGIDO

Añadida `Strict-Transport-Security` en `next.config.ts`. Los navegadores sólo la
aplican sobre HTTPS, así que no afecta al desarrollo en `localhost`.

---

## Fase 2 — Corrección

### 2.1 Un aviso podía desvanecerse antes de poder leerlo · CORREGIDO

`pauseTimers` descontaba el tiempo transcurrido pero no reponía `startedAt`. El
visor de avisos pausa **tanto al entrar el ratón como al recibir el foco**, así
que pasar el ratón por encima de un aviso y luego tabular hasta él lo pausaba dos
veces y descontaba el mismo intervalo dos veces. Con el tiempo justo, el aviso
desaparecía al instante de retirar el ratón.

Alcanza a los avisos de éxito y de advertencia; los errores son fijos y no
corrían peligro.

Prueba: `src/notifications/toast-timers.test.tsx`. **Verificado que falla contra
el código anterior** antes de dar el arreglo por bueno.

### 2.2 Temporizador de salida sin cancelar al desmontar · CORREGIDO

`dismiss` lanzaba un `setTimeout` que no se registraba en ningún sitio, de modo
que la limpieza del provider no lo alcanzaba. Ahora se registran y se cancelan.

### 2.3 Se reintentaban errores que nunca iban a cambiar · CORREGIDO

La política de reintentos de React Query sólo excluía el 403:

```ts
retry: (count, error) => !(… error.status === 403) && count < 1
```

Un 404, un 422 o un 409 se pedían **dos veces**, con lo que el operador esperaba
el doble para ver el mismo error. El 401 además duplicaba el trabajo que
`apiRequest` ya hace renovando el token, y el 429 empeora al insistir.

Ahora sólo se reintenta lo que pudo fallar por el camino (red, timeout, 5xx).
Prueba: `src/app/query-retry.test.ts`.

---

## Fase 3 — Accesibilidad

### 3.1 Ningún diálogo atrapaba el foco · CORREGIDO

Seis componentes declaraban `role="dialog"` + `aria-modal="true"`. Ninguno movía
el foco al abrirse (salvo uno), ninguno lo mantenía dentro y ninguno lo devolvía
al cerrarse. `aria-modal="true"` es una promesa al lector de pantalla —"lo de
detrás no existe"— que el código no cumplía: el primer tabulador se escapaba al
formulario de atrás.

Se añadió `src/hooks/useDialogFocus.ts` y se cableó en `ModalDialog`,
`ObjectiveCreateDialog`, `DeploymentCreateForm` y `TutorialDrawer`.

Un detalle que sólo apareció al probarlo: el filtro habitual de "¿se ve?"
(`element.offsetParent !== null`) vale `null` en todo elemento `position: fixed`
— y un modal siempre lo es. Habría dejado la trampa sin controles que atrapar.

Prueba: `src/components/dialog-focus.test.tsx`, cinco comportamientos.

### 3.2 Dos overlays mentían con `aria-modal` · CORREGIDO

Los recorridos guiados (`InteractiveTutorialOverlay`, `TutorialOverlay`)
declaraban `aria-modal="true"` mientras **exigen pulsar el elemento real de la
página** (`requiredAction`). Le decían al lector de pantalla que todo lo de fuera
estaba inerte justo cuando había que ir a usarlo. Se retiró el atributo: aquí lo
correcto es no ser modal, no atrapar el foco.

### 3.3 El gris tenue no llegaba a legible · CORREGIDO

Medido sobre los tokens:

| token     | antes (peor superficie) | ahora  |
| --------- | ----------------------- | ------ |
| `--faint` | **2,34:1**              | 4,51:1 |
| `--muted` | **4,47:1**              | 5,27:1 |

`--faint` no alcanzaba ni el mínimo de texto grande (3:1) y se usa en rótulos de
9 px en versalitas: era el texto menos legible del portal. En oscuro se quedaba
en 3,33:1.

Pruebas nuevas, ambas midiendo de verdad:

- `src/theme/theme-contrast.test.ts` — cada token de texto contra cada
  superficie, en los dos temas, exigiendo AA (4,5:1). Cazó `--muted` por su
  cuenta, que no estaba en el diagnóstico inicial.
- `e2e/contrast.spec.ts` — recorre el DOM ya pintado por **24 rutas en los dos
  temas** y calcula el contraste efectivo de cada texto contra el primer fondo
  opaco que tiene detrás. Lleva además un suelo de nodos inspeccionados por ruta:
  sin él, una página que no cargue pasa la prueba con cero incumplimientos, y
  "no encontré nada malo" se confundiría con "miré de verdad".

---

## Fase 4 — Sistema visual

### 4.1 94 referencias a tokens que no existían · CORREGIDO — el hallazgo más visible

Las hojas de la ampliación de contratos (`contracts.css`, `contract-panels.css`,
`calculated-fields.css`, `libraries-qa.css`) se escribieron contra un vocabulario
que **nunca se llegó a definir**: `--space-2`, `--space-3`, `--radius-sm`,
`--radius-md`, `--text-muted`, `--surface-muted`, `--danger-text`, `--font-mono`…

Esto no es cosmético. Ante `var(--no-existe)` sin respaldo, el navegador
**descarta la declaración entera**. De las 94 referencias, **74 no tenían
respaldo**: cada `padding`, `gap`, `margin`, `border-radius` y `color` escrito
así simplemente no se aplicaba. Las vistas `/calculated-fields`, `/libraries`,
`/qa-lab` y los paneles de contrato del editor se pintaban sin separaciones ni
esquinas redondeadas — y desde el navegador eso no se distingue de "así se
diseñó".

Corregido definiendo la escala en `parts/foundation.css` (no en `theme.css`: una
separación no depende de la luz), con valores que replican los que ya predominan
en las hojas escritas a mano, de modo que adoptar el token no mueve nada de
sitio. Los alias de color apuntan a los tokens existentes, así que sigue habiendo
una única fuente de color.

También se corrigió `--dur-1`, un nombre obsoleto de lo que `motion.css` llama
`--dur-fast`.

### 4.2 Deriva de paleta: 706 colores literales · 706 → 235

706 colores escritos a mano fuera de `theme.css`, con **34 grises casi idénticos**
entre sí (`#e2e8f0` vs `--line` `#dbe2ea`, `#475467` vs `--muted`…).

Se migraron en tres pasadas, cada una verificada midiendo el resultado:

1. **193 coincidencias exactas** con el valor de un token (mecánico: el mismo
   color, así que el tema claro se pinta idéntico).
2. **173 colores de texto**, con un mapa curado a mano por significado. La
   distancia numérica no basta: `#64748b` cae más cerca de `--faint`, pero **es**
   el antiguo `--muted` y ahí tenía que ir.
3. **105 fondos y bordes** de los estados semánticos, emparejados con el token de
   su familia (`#fffbeb` → `--warning-wash`…).

Quedan 235, casi todos en degradados, máscaras y colores de nodo del grafo.

**Cómo se supo que hacían falta las pasadas 2 y 3 — y una corrección al
diagnóstico inicial.** Tras la primera pasada, medir daba **cero** incumplimientos
en las ocho rutas del primer sondeo, y de ahí salió una conclusión precipitada:
"esto es sólo deuda de mantenimiento". Al ampliar la prueba a **24 rutas y a los
dos temas** aparecieron problemas reales de dos clases opuestas:

- **Regresión propia**: reglas a medio migrar. El fondo ya seguía al token y la
  letra seguía siendo literal (`#92400e` sobre panel oscuro, 2,4:1) o al revés
  (aviso ámbar del simulador sobre crema escrita a mano, **1,77:1**; insignias
  del editor de grafo a 1,44:1). Un estado a medias es peor que cualquiera de los
  dos completos, y sólo se cerró completando la migración.
- **Fallo preexistente**: los rótulos de sección de la barra lateral
  (`.nav-section > p`, `#8993a4`) llevaban **2,81:1 en tema claro** desde antes de
  esta auditoría. No se había visto porque nadie medía el tema claro — el oscuro
  ya los pintaba con `--faint`. Ahora lo hacen los dos.

La lección para el informe: medir sólo una mitad (un tema, ocho rutas) daba un
verde que no significaba nada.

---

## Fase 5 — El gate

### 5.1 El inventario de rutas llevaba tiempo desfasado · CORREGIDO

`verify-source.mjs` comprobaba una lista de 26 rutas escrita a mano, cerrada con
una tautología (`if (requiredRoutes.length !== 26)`: comparaba la longitud de un
array literal con una constante literal). El portal ya tenía 40 rutas: ninguna de
las nuevas —`/calculated-fields`, `/libraries`, `/qa-lab`, `/actions`,
`/code-import`, `/graph-editor`…— estaba cubierta.

Ahora la lista se deriva del árbol de páginas y se exige que **cada ruta tenga su
patrón en `route-access.ts`**, que es lo que de verdad importa: las rutas
desconocidas se deniegan por defecto, así que una vista sin regla no da un error
de permisos — desaparece. También avisa de reglas que ya no protegen nada.

Comprobado: la cobertura actual está completa (40/40), y el gate falla al añadir
una ruta sin regla.

### 5.2 Nueva regla: todo token debe resolver · AÑADIDO

`scripts/verify-conventions.mjs` rechaza cualquier `var(--token)` sin respaldo
cuyo token no esté definido en ninguna hoja. Es el guardarraíl de §4.1.

Comprobado: el gate falla al introducir `var(--space-9)`.

---

---

## Fase 6 — Cierre de los pendientes

### 6.1 Los colores literales, hasta el final · 706 → 61

Las tres pasadas anteriores dejaron 235. Para cerrar hacía falta admitir que el
problema no era migrar más rápido, sino que **al vocabulario le faltaban
palabras**: no existía forma de decir "ámbar profundo sobre fondo ámbar", ni
"esto es lo que quiero que mires", ni "esto es una consola". Sin ellas, cada
insignia y cada bloque de código tenía que inventarse su color.

Se añadieron a `theme.css`, con su pareja en tema oscuro:

- `--danger-strong` / `--warning-strong` / `--success-strong` / `--info-strong`,
  para texto sobre el fondo tenue de su propio estado. En claro son más oscuros
  que el token base; en oscuro, más claros — lo que manda es destacar del wash.
- `--highlight` / `--highlight-wash` / `--highlight-line`: el énfasis, que no es
  el acento de la marca ni un estado.
- `--code-surface` / `--code-ink`: oscuros en **los dos** temas a propósito. Un
  fragmento de código no debería verse distinto según la hora del día.

Con eso, una cuarta pasada curada migró 161 más y una revisión a mano cerró los
últimos `stroke`/`fill` de SVG y dos respaldos muertos (`var(--accent, #1d4ed8)`,
donde el token siempre existe y el respaldo nunca se usaba).

**Los 61 que quedan son deliberados**, no deuda: 24 son la identidad por tipo de
nodo (`--node-color`, que el tema oscuro conserva a propósito y del que deriva su
versión suave con `color-mix`), 22 son adornos donde el token no es la respuesta
(degradados, máscaras, sombras), 12 son valores propios del tema oscuro y 3 están
en comentarios.

Y para que no vuelvan: `verifyColorTokens` rechaza cualquier color escrito a mano
fuera de esas excepciones. Comprobado introduciendo un `color: #ff0000`.

### 6.2 Los parches del tema oscuro · 710 → 553 líneas

Un parche sobra cuando repite lo que la hoja clara ya resuelve. Eso se puede
detectar comparando declaraciones, y así se encontraron 31 reglas y 30
declaraciones sueltas.

**Pero "textualmente idéntico" no basta**, y conviene contarlo porque estuvo a
punto de colarse. `[data-theme='dark'] .ve-business { background: var(--warning-wash) }`
dice exactamente lo mismo que la hoja clara y aun así hace falta: sin ella gana
`[data-theme='dark'] .ve-card`, que va antes con la misma especificidad, y la
tarjeta pierde su tinte ámbar.

Lo cazó `e2e/style-fingerprint.spec.ts`, una herramienta nueva que anota el color,
el fondo y el borde **ya calculados** de cada elemento en 12 rutas. Se ejecuta
antes y después del cambio y se comparan los dos ficheros. El resultado final,
tras restaurar esa declaración: **0 diferencias en los dos temas**. El borrado no
es "probablemente seguro"; está demostrado.

### 6.3 Basura al borrar un nodo del grafo · CORREGIDO

`deleteSelectedNode` quitaba el nodo y sus aristas, pero dejaba atrás la condición
creada para ese nodo y el campo del contrato de salida que apuntaba a él. El
adaptador manda ambas listas tal cual, así que **viajaban al backend en el
siguiente guardado**: la versión archivada del artefacto describía un grafo que ya
no era el que se veía en pantalla. En algo que se audita, eso pesa más que el
desorden.

Ahora lo hace `withoutNode()`, con dos decisiones que las pruebas fijan:

- una condición sólo se borra si **nadie más la usa** — son reutilizables, y
  llevarse por delante la de otro nodo sería mucho peor que dejar una de sobra;
- el campo del contrato **se conserva con el origen vacío** en lugar de
  desaparecer, para que el hueco se vea en el panel y alguien decida qué hacer,
  en vez de publicar una versión a la que le falta una salida sin enterarse.

### 6.4 El contraste, también con la interfaz abierta

La prueba medía la carga inicial, donde no hay ni un diálogo abierto. Ahora cubre
además cinco estados que sólo existen tras interactuar —los dos diálogos de alta,
el centro de notificaciones, las dos formas del tutorial y el acceso rechazado—
en los dos temas. Un estado que deje de poder abrirse se denuncia en vez de darse
por comprobado en silencio.

---

---

## Fase 7 — Los últimos cabos

### 7.1 `:hover` y `:focus-visible`, medidos · AÑADIDO

Faltaba lo que aparece al pasar el ratón o al tabular, que es justo donde una
hoja cambia color y fondo a la vez. `e2e/contrast-states.spec.ts` fuerza el
pseudo-estado sobre todos los elementos interactivos a la vez —por el protocolo
de depuración, no moviendo el ratón uno a uno— y mide.

**La primera versión pasaba sin comprobar nada.** Desconectaba la sesión CDP
justo después de forzar, y desconectarla deshace el forzado, así que medía los
estilos en reposo. Se descubrió comparando contra un `hover()` real: el ratón
cambiaba los colores y el forzado no. Ahora la medición ocurre dentro de la
sesión. Verificado además al revés, metiendo un `:hover` ilegible a propósito:
lo denuncia en todas las rutas (1,12:1) y vuelve a verde al quitarlo.

`:focus-visible` era el más importante de los dos: quien navega con teclado no
tiene otra pista de dónde está.

### 7.2 Las herramientas, fuera de la suite · HECHO

`visual-evidence` y `style-fingerprint` no afirman nada —generan capturas y
huellas— y tardaban minutos dentro de la corrida normal. Se mueven a
`playwright.tools.config.ts` (`yarn test:e2e:tools`). La suite habitual queda en
28 pruebas que sí dicen si el código está bien; las 4 herramientas se piden
cuando hacen falta.

### 7.3 El flujo en vivo no se cerraba nunca · CORREGIDO

`apiEventStream` leía el cuerpo hasta que el servidor cerraba, y nada más. Tres
problemas encadenados:

- **La conexión no se cerraba.** Lanzar una segunda ejecución dejaba la primera
  drenando contra el motor —la página sólo ignoraba sus eventos con un contador
  de generación— y salir de la vista no cerraba ninguna.
- **Cancelar no interrumpía la lectura.** Pasar la señal a `fetch` no basta: para
  cuando llega la respuesta, leer el cuerpo ya es asunto aparte, y un `read()`
  pendiente sobre una ejecución en curso esperaba para siempre. Ahora se ata un
  oyente que cancela el lector, sin depender de qué haga cada `fetch` con la
  señal.
- **Se perdía el último evento.** Un servidor que cierra sin la línea en blanco
  final dejaba sin entregar el marco pendiente — normalmente el
  `execution_completed`, el que trae el resultado.

`LiveExecutionPage` aborta la ejecución anterior al relanzar y al desmontarse.
Cuatro pruebas nuevas en `src/api/http-client.test.ts`.

### 7.4 El centro de notificaciones perdía el foco · CORREGIDO

Cerrar con Escape dejaba el foco en el `<body>`, así que había que volver a
tabular media página. Ahora vuelve a la campana — sólo con Escape: quien cierra
pulsando fuera ya ha decidido dónde quiere estar.

### 7.5 Pruebas que fallaban por reloj y no por defecto · CORREGIDO

Al ampliar los barridos, cinco pruebas empezaron a agotar su plazo. No había
ningún fallo de contraste detrás: en desarrollo Turbopack compila cada ruta la
primera vez que se pide, y recorrer dos docenas cuesta minutos. Se ajustaron los
presupuestos a esa realidad (600 s los barridos, 90 s el resto, frente a los 30 s
de antes, que ya eran justos para cualquier prueba que tocara una ruta fría).

Es la peor clase de prueba inestable: enseña a reintentar en vez de a mirar.

> Nota de método: durante esta fase aparecieron dos falsos rojos causados por
> ejecutar `yarn build` con el servidor de desarrollo levantado — la build
> reescribe `.next` y el servidor en marcha se queda con módulos que ya no
> existen. No era el código. Si vuelve a verse un «module factory is not
> available» o rutas dando 404, la cura es parar el servidor, borrar `.next` y
> volver a arrancar.

---

---

## Fase 8 — Las continuaciones opcionales, y una de propina

### 8.1 La suite, contra el artefacto que se despliega · AÑADIDO

Toda la lentitud y la fragilidad de reloj venían de lo mismo: el servidor de
desarrollo compila cada ruta la primera vez que se pide. `yarn test:e2e:prod`
corre la misma suite contra el build standalone — **22/22 en 4,9 min**, sin un
solo plazo apurado, y ejercitando lo que de verdad se publica: CSP sin
`'unsafe-eval'`, código minificado, React en modo producción.

Hizo falta `scripts/serve-standalone.mjs`: `output: 'standalone'` deja el
servidor con sus dependencias pero **no copia los estáticos ni `public/`** —eso
lo hace la imagen de despliegue—, así que arrancarlo a pelo sirve HTML sin una
sola hoja de estilos. Es la clase de fallo que se confunde con "la aplicación
está rota".

### 8.2 Estados combinados · AÑADIDO

`:hover`, `:focus-visible` y **los dos a la vez**, que no es redundante: es lo
que ve quien tabula hasta un botón y además deja el ratón encima, y muchas hojas
escriben los dos con colores distintos sin pensar en quién gana. Seis pruebas,
todas en verde. Los estados que vienen de una clase —el enlace activo del menú,
la pestaña seleccionada— ya entraban solos: están en el DOM al cargar, así que
forzar `:hover` sobre ellos mide justamente la mezcla.

### 8.3 La pantalla de error global salía desnuda · CORREGIDO

Barriendo un área que no había mirado —los límites de error— apareció esto:
`global-error.next.tsx` **reemplaza al layout raíz**, así que no hereda nada de
él. No importaba la hoja de estilos ni repetía el script del tema, de modo que
la pantalla de último recurso se pintaba sin un solo estilo (la clase
`route-state-page` existía en el CSS, pero ese CSS nunca llegaba) y en blanco
para quien tuviera el tema oscuro puesto. Justo cuando ya ha fallado todo lo
demás.

Corregido y fijado con `src/app/global-error.test.tsx`, que comprueba el
contrato sobre el propio código: no se puede renderizar en jsdom porque monta su
propio `<html>`, y lo que importa no es lo que pinta sino lo que arrastra
consigo.

### 8.4 Repaso de forma

- **Deduplicación real**: el umbral AA y el inventario de rutas estaban escritos
  en dos especificaciones. Ahora viven una sola vez en `contrast-probe.ts` — un
  umbral repetido es un umbral que acabará valiendo dos cosas distintas.
- **Comentarios que mentían**: dos apuntaban a `src/middleware.ts`, que no es el
  nombre real del archivo; y la cabecera de `contrast-probe.ts` describía sólo
  la mitad de lo que el módulo ya contenía.
- **Revisión visual, mirando**: se generó la evidencia y se comprobó a ojo en los
  dos temas. De paso se descartó un falso positivo —el pie de la barra lateral
  parecía solaparse con el menú en las capturas de página completa— midiendo las
  cajas: se tocan exactamente, sin solape. El artefacto lo causa capturar un
  elemento `position: fixed` a página completa.

---

## Fase 9 — Que los guardarraíles se apliquen solos

### 9.1 La integración continua no corría ni una prueba de navegador · CORREGIDO

El flujo de CI ejecutaba formato, lint, tipos, unitarias y build. **Ninguna
prueba end-to-end.** Es decir: toda la red que se había ido construyendo
—errores en tiempo de ejecución, contraste efectivo, foco de los diálogos— sólo
se aplicaba si alguien se acordaba de lanzarla a mano. Un guardarraíl que hay que
recordar es una sugerencia.

Y había algo peor de fondo: el disparador por `push` apuntaba a la rama
`migration/next-app-router`, **que ya no existe**. Sólo los pull request
disparaban nada; lo que entrara directo a `main` no se comprobaba.

`.github/workflows/verify.yml` lo sustituye con dos trabajos: uno estático
—barato, primero, para no levantar un navegador si los tipos no cuadran— y otro
de navegador que corre `yarn test:e2e:prod` contra el build de producción y sube
las trazas si algo falla.

### 9.2 Los barridos medían páginas vacías · CORREGIDO

Al preparar la medición con datos reales apareció que el motor simulado devuelve
**listados vacíos** para casi todo. Las pruebas de contraste llevaban toda la
auditoría midiendo cabeceras, barras de herramientas y estados vacíos: nada de lo
que vive DENTRO de una tabla —insignias de estado, códigos monoespaciados, celdas
truncadas— había pasado nunca por el medidor. Justo donde más fácil se queda una
regla a medio migrar.

`e2e/support/dense-backend.ts` llena los listados: 25 filas por vista, las doce
variantes de estado repartidas entre ellas y textos que desbordan su celda a
propósito. Comprobado que llena de verdad —25 filas y hasta 75 insignias por
ruta— antes de creerse el resultado.

El resultado: **cero incumplimientos** también con las tablas llenas, en los dos
temas. La migración de color aguanta con datos reales, no sólo con vistas vacías.

---

## Estado final

- `yarn verify` en verde: **498 pruebas** (111 nuevas sobre las 387 de partida).
- Playwright, **26 pruebas afirmativas** en verde contra el build de producción
  (`yarn test:e2e:prod`), y también contra el servidor de desarrollo.
- Todo lo anterior se ejecuta ahora en integración continua, no a mano.
- Contraste AA (4,5:1) sin una sola excepción en: **24 rutas × 2 temas**,
  **6 estados interactivos × 2 temas**, **`:hover`, `:focus-visible` y la
  combinación de ambos × 2 temas** y **las tablas llenas × 2 temas**.
- Colores literales fuera de `theme.css`: **706 → 61**, y los 61 son deliberados.
- Parches del tema oscuro: **710 → 553 líneas**, con 0 diferencias de estilo
  calculado demostradas.

Los cuatro pendientes de la primera vuelta, los dos que quedaron abiertos después
y las dos continuaciones opcionales están cerrados. No queda ninguno.

## Herramientas que quedan para la próxima vez

- `e2e/contrast.spec.ts` — contraste real en rutas y en estados abiertos, los dos
  temas. `contrast-states.spec.ts` añade `:hover` y `:focus-visible`, y
  `contrast-dense.spec.ts`, las tablas llenas.
- `e2e/support/contrast-probe.ts` — el medidor, el listón AA y el inventario de
  rutas, en un solo sitio para que no puedan discrepar.
- `e2e/support/dense-backend.ts` — motor simulado con listados llenos: 25 filas,
  las doce variantes de estado y textos que desbordan. Úsalo siempre que quieras
  probar algo que sólo se ve cuando hay datos.
- `e2e/style-fingerprint.spec.ts` — huella de estilos calculados, para
  refactorizar CSS y **demostrar** que no cambió nada en lugar de confiar.
- `scripts/verify-conventions.mjs` — tres reglas en el gate: toda ruta con su
  política de acceso, todo token resuelto, ningún color escrito a mano.
- `scripts/serve-standalone.mjs` + `playwright.prod.config.ts` — la suite contra
  el artefacto que se despliega (`yarn test:e2e:prod`).
- `src/theme/theme-contrast.test.ts` — el suelo AA de la paleta, incluidas las
  parejas `*-strong` sobre su wash y el par de la superficie de código.
- `.github/workflows/verify.yml` — todo lo anterior, ejecutándose solo.

## Lo que un día convendría mirar (nada pendiente)

No queda ningún hallazgo abierto ni ninguna continuación apuntada. Lo que sigue
son ideas, no deuda:

- **Presupuestos de rendimiento** (tamaño de bundle por ruta, tiempo hasta el
  primer pintado). Es la dimensión que esta auditoría no tocó: se miró que todo
  fuera correcto, legible y seguro, no que fuera rápido.
- **Contraste de gráficos y del lienzo del grafo**, donde el color no es texto
  sobre fondo sino trazo sobre trazo. El medidor actual no sabe leer eso.
