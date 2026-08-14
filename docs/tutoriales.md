# Motor de tutoriales interactivos

Recorridos guiados sobre la interfaz **real** del portal: el motor resalta un
elemento de la pantalla, explica qué es y —cuando el paso lo pide— espera a que
la persona haga la acción de verdad. No hay capturas ni simulaciones.

Dos formas de entrar:

1. **Ayuda de cada pantalla** — el botón junto al título (`TutorialMenu`).
2. **Centro de Tutoriales** (`/tutorials`) — catálogo completo con tu avance.

---

## 1. Arquitectura

```
src/features/tutorial/
├── interactive-types.ts            Contratos: paso, tutorial, metadatos, categoría, nivel
├── interactive-catalog.ts          Une los catálogos y resuelve ruta→tutorial y error→tutorial
├── interactive-catalog-onboarding.ts   Bienvenida, navegación, sesión, uso del Centro
├── interactive-catalog-tools.ts    Catálogos y calidad (listados)
├── interactive-catalog-ops.ts      Operación y gobierno
├── interactive-catalog-detail.ts   Fichas de detalle (artefacto, ejecución, revisión, objetivo)
├── interactive-catalog-editor.ts   Editor de grafo: mapa de herramientas + construcción guiada
├── interactive-catalog-lab.ts      Campos calculados, librerías y QA Lab (§5–§10)
├── interactive-catalog-workers.ts  Workers de procesamiento y matriz de cobertura
├── interactive-catalog-audit.ts    La traza: ejecuciones, bitácora y derechos del titular
├── interactive-catalog-measure.ts  Las tres pantallas de medición, en su orden
├── interactive-catalog-errors.ts   Recorridos de corrección de errores
├── tutorial-registry.data.ts       Fichas del Centro (categoría, nivel, ruta, prerrequisitos)
├── tutorial-registry.data.audit.ts Fichas de «Auditoría» y trazabilidad (bloque que se lee entero)
├── tutorial-registry.ts            Lectura del registro + filtrado por rol
├── tutorial-navigation.ts          Rutas por paso, pasos aplicables, acotado del progreso
├── tutorial-center-state.ts        Estado, filtros y resumen de avance (lógica pura)
├── InteractiveTutorialProvider.tsx Máquina del recorrido (estado + persistencia + navegación)
├── InteractiveTutorialOverlay.tsx  Overlay, resalte, tarjeta y confirmación de salida
├── overlay-hooks.ts                Colocación de la tarjeta y detección de elemento inerte
├── useTutorialTarget.ts            Localiza el elemento, incluso si aparece tarde
├── useTutorialProgress.ts          Progreso: backend + caché local
├── TutorialCard.tsx                Tarjeta de un recorrido en el Centro
├── TutorialCenterFilters.tsx       Buscador y filtros
└── TutorialCenterSummary.tsx       Avance general y recomendados

src/pages/TutorialCenterPage.tsx    El Centro
src/app/(portal)/tutorials/         La ruta
src/styles/parts/tutorial-center.css, tutorial-cards.css, interactive-tutorial.css
```

**Regla de oro:** añadir un tutorial NO toca el motor. Se escribe su definición
de pasos y su ficha en `tutorial-registry.data.ts`. Nada más.

### Flujo de ejecución

```
usuario pulsa "Comenzar"
   → start(id, { resume })            InteractiveTutorialProvider
   → tutorialById(id)                 busca la definición
   → clampStep(...)                   acota el paso guardado al rango real
   → tutorialRoute(tutorial, paso)    ¿en qué pantalla vive este paso?
   → router.push(ruta)                si no estamos ahí, navega
   → useTutorialTarget(selector)      espera al elemento (reintentos + MutationObserver)
   → overlay resalta y explica
   → next()/previous()                salta pasos opcionales sin elemento
   → markCompleted / markSkipped      persiste avance
```

---

## 2. Estructura de un tutorial

Un tutorial tiene **dos partes**, deliberadamente separadas:

### a) Los pasos (`InteractiveTutorial`)

```ts
{
  id: 'variables',
  title: 'Catálogo de Variables',
  intro: 'Los datos con los que deciden tus algoritmos.',
  version: 2,              // súbela cuando cambien los pasos
  steps: [ /* InteractiveStep[] */ ],
}
```

### b) La ficha del Centro (`TutorialMeta`)

```ts
{
  id: 'variables',
  category: 'diseno',      // agrupación en el Centro
  level: 'basico',         // básico | intermedio | avanzado
  route: '/variables',     // pantalla que enseña → de aquí sale el PERMISO
  estimatedMinutes: 4,
  prerequisites: ['artifacts'],
  recommended: true,       // se ofrece en "Empieza por aquí"
  essential: true,         // recorrido troncal
}
```

### Un paso

| Campo            | Para qué                                                         |
| ---------------- | ---------------------------------------------------------------- |
| `id`             | Único dentro del tutorial (lo verifica una prueba).              |
| `title`          | Una frase corta.                                                 |
| `content`        | La explicación. Mínimo 40 caracteres: no vale "Pulsa aquí".      |
| `tip`            | Aparte opcional: atajo, consecuencia o buena práctica.           |
| `target`         | Selector. **Preferir `[data-tutorial-id="..."]`.**               |
| `requiredAction` | `click` \| `input` \| `submit`: el paso espera la acción real.   |
| `optional`       | Si su elemento no está, el paso se salta en vez de bloquear.     |
| `route`          | Sólo en los pasos que CAMBIAN de pantalla; los demás la heredan. |
| `dynamicRoute`   | Corta la herencia: el paso ocurre donde el usuario haya llegado. |

---

## 3. Crear un tutorial nuevo

**Paso 1 — marca los elementos** en el componente:

```tsx
<button data-tutorial-id="crear-variable">Nueva variable</button>
```

Usa un atributo estable, nunca una clase CSS: las clases se renombran al
rediseñar y el recorrido se queda apuntando a la nada.

Dos componentes compartidos aceptan el ancla como prop, para no envolverlos en un
`<div>` que cambiaría el espaciado de la página:

```tsx
<Panel title="Cobertura del circuito" tutorialId="quality-coverage">…</Panel>
{ id: 'apetito', label: 'Apetito', tutorialId: 'risk-tab-appetite' }  // TabDefinition
```

En una vista por pestañas, señala **la pestaña** y espera el clic antes de hablar
de lo que hay dentro: el contenido de la pestaña inactiva se monta con `hidden`, y
un paso que apunte ahí resaltaría un rectángulo vacío.

**Paso 2 — escribe los pasos** en el catálogo del módulo que corresponda:

```ts
export const TOOL_TUTORIALS = {
  'mi-modulo': {
    id: 'mi-modulo',
    title: 'Mi módulo',
    intro: 'Para qué sirve esta pantalla, en una frase.',
    version: 1,
    steps: [
      {
        id: 'intro',
        title: '¿Qué veo aquí?',
        content: 'Explicación en lenguaje llano, sin jerga técnica.',
      },
      {
        id: 'crear',
        target: '[data-tutorial-id="crear-variable"]',
        title: 'Dar de alta',
        content: 'Abre el formulario de creación. Cada campo lleva su ejemplo.',
        requiredAction: 'click',
        optional: true,
      },
    ],
  },
};
```

**Paso 3 — añade su ficha** en `tutorial-registry.data.ts`:

```ts
{ id: 'mi-modulo', category: 'diseno', level: 'basico',
  route: '/mi-modulo', estimatedMinutes: 4 }
```

**Paso 4 — si quieres que se ofrezca desde su propia pantalla**, registra la
ruta en `ROUTE_TUTORIAL` (`interactive-catalog.ts`).

Listo. `yarn test` verifica el resto.

---

## 4. Casos que el motor ya resuelve

| Situación                      | Comportamiento                                                     |
| ------------------------------ | ------------------------------------------------------------------ |
| Elemento que tarda en aparecer | Reintentos 3 s + `MutationObserver` sin límite de tiempo.          |
| Elemento que **no existe**     | La tarjeta se centra, avisa y deja continuar. Nunca bloquea.       |
| Elemento deshabilitado         | Se detecta y se ofrece "Siguiente" en lugar de esperar un clic.    |
| Paso en otra ruta              | El motor navega antes de resaltar.                                 |
| Lanzado desde el Centro        | No descarta pasos opcionales de la vista destino (aún no montada). |
| Paso guardado fuera de rango   | `clampStep` lo acota; nunca deja el recorrido en blanco.           |
| Función no disponible por rol  | El paso `optional` se salta solo.                                  |

---

## 5. Roles y permisos

La visibilidad **se deriva** de la ruta que el tutorial enseña:

```ts
canSeeTutorial(meta, roles) → meta.route ? canAccessPath(meta.route, roles) : true
```

No existe una tabla de permisos de tutoriales. Duplicar `route-access.ts` sería
una segunda fuente de verdad que se desincronizaría en silencio: un módulo
restringido dejaría su tutorial visible y el recorrido llevaría a una pantalla
prohibida.

Consecuencias:

- Un tutorial **sin** `route` es universal (bienvenida, sesión, errores).
- El porcentaje de avance se mide **sólo** sobre lo que el rol alcanza, así que
  el 100 % es alcanzable de verdad.
- Los prerrequisitos también se filtran por rol: nunca se exige un recorrido
  que la persona no puede abrir.

El tutorial **nunca** evade una validación de permiso: sólo señala y explica.

---

## 6. Versionado

`TutorialProgress.version` guarda la versión que la persona recorrió.

- `version` guardada **<** `version` del catálogo y estado `COMPLETED`
  → el Centro lo marca **"Actualizado"**, no "pendiente": sí lo hizo, pero ahora
  enseña otra cosa. El botón pasa a "Ver lo nuevo".
- No cuenta como completado en el porcentaje: queda algo por ver.
- No se borra el historial (`repeatCount`, `startedAt`).

Sube `version` cuando **cambie lo que el recorrido enseña**, no por corregir una
tilde.

---

## 7. Persistencia

Fuente de verdad: **backend** `/v1/tutorial-progress`. `localStorage` es caché.

| Operación                 | Método y ruta                    |
| ------------------------- | -------------------------------- |
| Leer todo el progreso     | `GET /v1/tutorial-progress`      |
| Guardar el de un tutorial | `PUT /v1/tutorial-progress/{id}` |

Cuerpo del `PUT` (idempotente — el mismo cuerpo dos veces deja el mismo estado):

```jsonc
{
  "status": "STARTED" | "COMPLETED" | "SKIPPED",
  "lastStep": 3,
  "version": 2,
  "autoShow": true,
  "startedAt": "2026-08-04T12:00:00.000Z",
  "completedAt": null,
  "lastInteractionAt": "2026-08-04T12:04:00.000Z",
  "repeatCount": 1
}
```

El identificador viaja **sólo en la ruta**. Repetirlo en el cuerpo permitiría
enviar uno distinto del de la URL y escribir sobre otro tutorial. El backend
debe derivar el usuario del token: nadie puede tocar el progreso de otro.

**Estrategia de sincronización.** Cada cambio se escribe primero en local y
luego se intenta subir; si el backend falla, queda local y se reconcilia en la
siguiente carga. Al cargar, las filas del servidor **se fusionan** sobre la
caché en lugar de sustituirla: quien hiciera tutoriales mientras el endpoint no
existía perdía todo su progreso en cuanto el backend empezaba a responder con
una lista vacía.

---

## 8. Accesibilidad

- El overlay **no** declara `aria-modal`: los pasos con `requiredAction` piden
  pulsar el elemento REAL de la página. Decir que todo lo de fuera está inerte
  justo cuando hay que ir a usarlo dejaría el recorrido imposible de seguir.
- `Escape` sale (pidiendo confirmación si hay avance); `←` / `→` recorren pasos.
- La confirmación de salida es un `alertdialog` dentro de la tarjeta, no un
  `window.confirm` (que ignora el tema y no se puede leer con el resto).
- Barra de progreso con `role="progressbar"` y valores reales.
- El estado de cada tarjeta se comunica con **icono + palabra + posición**,
  nunca sólo con color.
- Todo el color sale de tokens: contraste AA verificado en ambos temas por
  `theme-contrast.test.ts` y `e2e/contrast.spec.ts`.

---

## 9. Pruebas

```bash
yarn test                                   # unitarias y de integración
npx vitest run src/features/tutorial        # sólo el motor
yarn build && yarn test:e2e:prod            # E2E contra el artefacto real
```

| Archivo                         | Cubre                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| `tutorial-registry.test.ts`     | Duplicados, huérfanos, rutas inexistentes, ciclos, roles.           |
| `route-coverage.test.ts`        | Que cada ficha se ofrezca en alguna pantalla, no sólo en el Centro. |
| `tutorial-engine.test.tsx`      | Navegación, reanudar, reiniciar, versión, salida, teclado.          |
| `tutorial-center-state.test.ts` | Estados, filtros, resumen de avance.                                |
| `catalog-audit.test.ts`         | Que cada paso apunte a un elemento que existe en el código.         |
| `TutorialCenterPage.test.tsx`   | El Centro por rol, filtros, continuar/repetir.                      |
| `interactive-tutorial.test.tsx` | Acción requerida y cadena error→tutorial.                           |
| `e2e/tutorial-center.spec.ts`   | Navegación real, resalte asíncrono, recarga, móvil.                 |
| `e2e/error-tutorial.spec.ts`    | Error del motor → recorrido de corrección.                          |

Ninguna depende de temporizadores frágiles: se espera por condiciones
explícitas (`waitFor`, `toBeVisible`), no por `sleep`.

---

## 10. Diagnóstico

| Síntoma                                 | Causa habitual                                                              |
| --------------------------------------- | --------------------------------------------------------------------------- |
| El recorrido no aparece en el Centro    | Falta su ficha en `tutorial-registry.data.ts`, o el rol no alcanza `route`. |
| "Esto no está en pantalla" en cada paso | El `data-tutorial-id` se renombró. `catalog-audit.test.ts` lo caza.         |
| El paso no avanza                       | `requiredAction` sobre un elemento inerte. Márcalo `optional`.              |
| No navega a la pantalla                 | Falta `route` en la ficha y ningún paso la declara.                         |
| El progreso no persiste                 | El backend no expone `/v1/tutorial-progress`; queda en local.               |
| Falla `verify:source`                   | Ruta nueva sin regla en `route-access.ts`, o token CSS inexistente.         |

---

## 11. Decisiones tomadas

1. **El permiso se deriva de la ruta**, no se declara aparte. Evita una segunda
   fuente de verdad sobre quién ve qué.
2. **Los metadatos viven fuera de los pasos.** Los catálogos rozan el límite de
   299 líneas del repositorio y el Centro no necesita cargar los recorridos
   enteros para listarlos.
3. **El motor no importa `next/navigation`.** Recibe un `TutorialRouter`
   (`{ pathname, push }`) desde `NextAppShell`: se puede probar sin montar un
   router y no queda atado al framework de rutas.
4. **Sin dependencias nuevas.** Todo con React 19, `lucide-react` y el sistema
   visual existente. No se instaló ninguna librería de product tours.
5. **Salir a medias guarda el paso** (`SKIPPED` con `lastStep`), para poder
   ofrecer "Continuar" en vez de obligar a repetir desde el principio.
6. **La invitación al recorrido introductorio no arranca sola.** Secuestrar la
   pantalla de alguien que venía a trabajar es la forma más rápida de que
   aprenda a cerrar la ayuda sin leerla: se ofrece, y se puede silenciar.

---

## 12. Recorridos de ficha (ruta dinámica)

Los que enseñan el detalle de un registro —`artifact-detail`,
`execution-detail`, `manual-review`, `objective-detail`— viven en una ruta que
depende de qué se abra (`/artifacts/{id}`). El motor no puede inventar ese id,
así que el recorrido lo pide:

```ts
steps: [
  openRecordStep('/artifacts', 'un artefacto', 'Haz clic en cualquier fila…'),
  inRecord({ id: 'intro', title: 'Qué es esta pantalla', content: '…' }),
  // …el resto de pasos ya ocurren dentro de la ficha
];
```

- `openRecordStep` lleva al **listado** y espera el clic real sobre la tabla.
  Es `optional`: un listado vacío no puede dejar el recorrido colgado.
- `inRecord` marca el paso con `dynamicRoute: true`, que **corta la herencia de
  ruta**. Sin eso, cada paso siguiente heredaría `/artifacts` y devolvería a la
  persona al listado en bucle.

## 12 bis. Varios recorridos en una misma pantalla

Una vista puede responder a dos preguntas distintas. El editor de grafo tiene
las dos: «¿qué hace este botón?» y «¿y cómo hago un algoritmo?». Se resuelven
con dos recorridos, no con uno largo:

| Id                       | Responde a                               | Forma                                          |
| ------------------------ | ---------------------------------------- | ---------------------------------------------- |
| `graph-editor`           | Qué hace cada herramienta                | Mapa: un paso por control, sin acciones        |
| `graph-editor-algoritmo` | Cómo se construye uno de principio a fin | Construcción: pide la acción real en cada paso |

`tutorialForRoute()` devuelve **el principal**. Los adicionales se declaran en
`ROUTE_EXTRA_TUTORIALS` (`interactive-catalog.ts`) y `tutorialsForRoute()` los
une, que es lo que consume `TutorialMenu` para ofrecerlos todos desde el botón
de la pantalla.

Es una tabla explícita a propósito. Derivarla de `route` en el registro
arrastraría los recorridos de ficha (§12) a las pantallas de listado: el de
`artifact-detail` está registrado en `/artifacts`, y aparecería como si fuese
un segundo recorrido del listado.

> Sin esta tabla, el botón «Tutorial» de la pantalla sólo alcanzaba al primero y
> el segundo quedaba únicamente en el Centro de Tutoriales — que es justo donde
> **no** está quien tiene la duda.

## 13. Analítica

El motor emite siempre; quién escucha se inyecta:

```tsx
<InteractiveTutorialProvider analytics={miAdaptador} />
```

| Evento      | Cuándo                          | Para qué sirve               |
| ----------- | ------------------------------- | ---------------------------- |
| `started`   | Al abrir (con `repeat`/`from`)  | Cuántos lo intentan.         |
| `step`      | Cada paso **visto**             | Dónde se atasca la gente.    |
| `completed` | Al terminar el último           | Tasa de finalización.        |
| `abandoned` | Al salir a medias, con `stepId` | Qué explicación no funciona. |

`abandoned` es el que `lastStep` no puede dar: el registro guarda el último
valor, no distingue una pausa de una rendición.

Por omisión **no se envía nada a ninguna parte** (`noopAnalytics`): no hay
endpoint de analítica en el motor y fabricar tráfico que nadie pidió sería peor
que no medir. `safeAnalytics` envuelve al adaptador para que un fallo suyo no
tumbe el recorrido: medir es accesorio, aprender no.

## 14. Limitaciones conocidas

- **El progreso entre dispositivos depende de que el backend exponga
  `/v1/tutorial-progress`.** Si no existe, todo funciona pero el avance se queda
  en el navegador.
- **No hay adaptador de analítica conectado.** El contrato y los eventos existen
  y están probados, pero el destino real está por decidir (§13).
- **La invitación introductoria sólo aparece en `/platform-health`.** Quien
  entre directo a una vista profunda por un enlace no la verá; tiene el Centro
  y el botón de ayuda de cada pantalla.
- **`openRecordStep` asume un listado con `resource-table`.** Las vistas de
  detalle que no cuelguen de un `ResourceListPage` necesitarían su propio paso
  de apertura.
