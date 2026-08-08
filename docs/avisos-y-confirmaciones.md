# Avisos, confirmaciones y diálogos

Cómo el portal le cuenta algo al operador: qué superficie usar, quién es
responsable de cada mensaje y qué garantiza el motor.

Una sola superficie, en `src/notifications/`. Ninguna vista monta su propia pila
de avisos ni su propio diálogo de borrado.

## Las cuatro superficies

| Superficie | Cuándo                                                     | Dónde                                    |
| ---------- | ---------------------------------------------------------- | ---------------------------------------- |
| Toast      | La acción ya terminó y no hay que decidir nada             | `ToastViewport` + `useNotifications()`   |
| Diálogo    | Hay que decidir, o la acción es irreversible               | `ModalDialog`, `ConfirmButton`           |
| Inline     | El fallo pertenece a un campo o a una sección concreta     | La propia vista                          |
| Campana    | El aviso debe sobrevivir a la sesión y consultarse después | `NotificationCenter` (inbox del backend) |

La campana y los toasts son cosas distintas a propósito: la campana la sirve el
backend (`GET /v1/notifications`), los toasts viven en memoria y se pierden al
recargar. Un toast que importe mañana no es un toast.

## Quién anuncia los fallos

**Regla única: las vistas sólo añaden avisos de éxito.** Todo fallo de mutación
lo anuncia el `MutationCache` de `src/app/QueryProvider.tsx`, que traduce el
`ApiError` a un título por tipo de fallo (`validation` → «Datos inválidos»,
`forbidden` → «Permiso denegado»…), añade la explicación del catálogo de
tutoriales cuando el código la tiene, y arrastra el `requestId` para poder
rastrearlo.

Una vista que quiera contar el fallo ella misma —con su diálogo, con acceso al
tutorial que enseña a corregirlo— debe declararlo:

```ts
const save = useMutation({
  meta: { handled: true }, // yo lo muestro; el aviso global sobra
  mutationFn: () => apiRequest('/v1/…', { method: 'PUT', body }),
});
```

Sin `meta.handled`, poner un `onError` que avise produce **dos** tarjetas para un
único fallo. Es el defecto que tenía `GraphNotesPanel` y por el que existe la
regla.

## API

```ts
const { notify, update, promise, dismiss } = useNotifications();

notify({ tone: 'success', title: 'Versión enviada' });

// Una operación larga: en curso y desenlace en la MISMA tarjeta.
await promise(save(payload), {
  loading: 'Guardando cambios…',
  success: (saved) => `Guardado ${saved.version}`,
});

// Avance conocido, si se sabe cuánto falta.
const id = notify({ title: 'Procesando archivo', progress: null, durationMs: null });
update(id, { progress: 0.65 });
update(id, { tone: 'success', title: 'Archivo procesado' });
```

`promise()` existe para no poder mentir: el texto de éxito no se puede escribir
hasta que la promesa se cumple, así que un 409 no puede dejar en pantalla un
acierto que no ocurrió. Si no se le da texto de error, **retira** su tarjeta y
deja hablar al aviso global —no cuenta el fallo dos veces—.

### Procesos que tardan

La ejecución en vivo (`LiveExecutionPage`) es la única superficie que transmite
por SSE, y es el ejemplo canónico de `update()`: una sola tarjeta acompaña la
ejecución de principio a fin —«en curso» → «N nodos recorridos» → el desenlace—,
así que quien haya bajado la página se entera igual de cómo acabó.

Tres reglas que esa vista respeta y que conviene copiar:

- Al **relanzar**, el aviso de la ejecución anterior se retira: ya no hay quien
  lo termine.
- Al **abandonar la vista** se corta la conexión y se retira el aviso. Si no,
  quedaría una tarjeta girando para siempre sobre una ejecución que nadie
  escucha: el motor no contesta a una conexión cancelada.
- Si el motor **cierra sin decir en qué acabó**, el aviso se retira en vez de
  inventarle un desenlace. Declarar un éxito que nadie confirmó es peor que
  callarse.

### Duraciones

Por tono, en `notification-queue.ts`; no se escriben números sueltos en las
vistas. Éxito 4,5 s · info 5 s · aviso 7 s · **fallo, hasta que se acuse**.

## Lo que garantiza la cola

`src/notifications/notification-queue.ts` — lógica pura, sin React, probada
aparte en `notification-queue.test.ts`.

- **Prioridad al recortar.** Caben cuatro avisos. Al quinto se sacrifica el
  menos grave (`error > warning > success > info`), no el más antiguo: cuatro
  guardados correctos seguidos ya no echan de la pantalla el fallo pegajoso que
  los precedía.
- **Repeticiones fundidas.** El mismo suceso repetido sube un contador (`×3`) y
  repone su cuenta atrás en lugar de apilar copias. La huella sale del tono y los
  textos, o se pasa a mano con `dedupeKey` para fundir mensajes que se escriben
  distinto —los reintentos de un despliegue, por ejemplo—. Ventana de 5 s para
  los avisos con cuenta atrás; los pegajosos no caducan como repetición, porque
  un fallo que lleva media hora sin acusarse sigue siendo el mismo fallo.

## Confirmaciones

Todo lo que destruye pasa por `ConfirmButton`, que exige `description`: la
pregunta sólo sirve si nombra **la consecuencia**, no si repite el título.

```tsx
<ConfirmButton
  title="¿Eliminar el paso «Rechazo KYC»?"
  description={<p>Se borra el paso y todas sus conexiones.</p>}
  confirmLabel="Eliminar el paso"
  onConfirm={() => remove(node.id)}
>
  Eliminar nodo
</ConfirmButton>
```

Si `onConfirm` devuelve una promesa, el diálogo se queda puesto y con los dos
botones bloqueados hasta que se resuelva: el doble clic —que es un reflejo— ya no
manda dos borrados, y Escape no cierra a media faena.

No se confirma lo trivial. Una edición corriente no pregunta: hace y luego lo
cuenta. La pregunta se reserva a lo irreversible, a lo que afecta a producción y
a lo que cambia permisos.

## Accesibilidad

- Todo `role="dialog"` + `aria-modal="true"` usa `useDialogFocus()`: lleva el
  foco dentro, lo atrapa y lo devuelve al cerrar. Un overlay que exija pulsar la
  página de detrás (los recorridos guiados) **no** lleva `aria-modal`, porque
  sería mentira.
- Los fallos se anuncian con `role="alert"` (interrumpen); el resto con
  `role="status"` (esperan turno).
- Las cuentas atrás se congelan al pasar el ratón **y al recibir el foco**, para
  que quien navega con teclado tenga el mismo tiempo de lectura.
- Nada depende sólo del color: el contador de repeticiones es una cifra, el
  avance lleva `role="progressbar"`, y cada tono lleva su icono.
- `prefers-reduced-motion` quita el giro del icono, la transición de la barra y
  el carril de cuenta atrás. Los temporizadores de JS no se tocan: el aviso se
  retira igual.

## Pruebas

| Archivo                          | Qué fija                                          |
| -------------------------------- | ------------------------------------------------- |
| `notification-queue.test.ts`     | Prioridad, huellas y ventana de repetición (puro) |
| `notification-progress.test.tsx` | Fusión, avance, `update`, `promise`               |
| `notifications.test.tsx`         | Cuentas atrás, historial, no leídos               |
| `toast-timers.test.tsx`          | Pausa doble y limpieza de temporizadores          |
| `ConfirmButton.test.tsx`         | Doble clic, bloqueo durante la operación, Escape  |
| `dialog-focus.test.tsx`          | Foco dentro, atrapado y devuelto                  |
| `e2e/notifications.spec.ts`      | Fusión y ciclo de vida sobre el DOM real          |
| `e2e/contrast.spec.ts`           | Contraste AA en 24 rutas y en los dos temas       |

`e2e/notifications.spec.ts` mide además que el contador **se vea**: la insignia
usaba `background: currentColor` junto a `color: var(--surface)`, y currentColor
se resuelve contra el color del propio elemento —blanco sobre blanco—. El «×3»
estaba en el DOM e invisible, y una prueba de texto lo daba por bueno. Por eso
compara el fondo con la letra, no sólo el contenido.

## Pendiente

- Los eventos en vivo ya se anuncian mientras la vista está montada, pero **no
  llegan a la campana**: ésa la sirve el backend (`GET /v1/notifications`), así
  que persistir «tu ejecución terminó» exige que el motor la emita. Abandonar la
  vista sigue cancelando la ejecución —es una vista previa sin persistencia, por
  diseño—, de modo que hoy no hay ningún suceso de fondo que sobreviva a la
  navegación.
- No hay internacionalización, y **añadirla sólo aquí sería peor que no tenerla**:
  el portal entero escribe sus textos en el punto de uso. Un catálogo que cubriera
  los avisos mientras seiscientos archivos siguen con literales daría la falsa
  señal de que el portal está internacionalizado. Es un cambio transversal y hay
  que hacerlo de una vez, no por un módulo.
