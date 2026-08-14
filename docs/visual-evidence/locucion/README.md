# Evidencia — worker de locución (audio TTS)

Dos cosas distintas, y conviene no confundirlas: **las capturas** miden cómo se
lee la pantalla, y **la sonda contra el motor real** mide que el worker existe y
funciona. Una captura no demuestra que el audio se genere; una respuesta HTTP no
demuestra que alguien entienda lo que ve.

## Capturas

Las genera `e2e/locucion.spec.ts` contra el motor **simulado**
(`e2e/support/workers-backend.ts`), que es como se produce el resto de la
evidencia curada de este repositorio:

```bash
yarn playwright test e2e/locucion.spec.ts
```

Esa especificación **afirma y fotografía a la vez**. Es deliberado: una captura
sin aserción no detecta nada, y una aserción sin captura no deja ver si el
resultado se lee. Además cada disparo espera una señal POSITIVA —el reproductor,
la vista previa, la insignia— y no la desaparición de un indicador de carga, que
es como una corrida verde acabó dejando 440 fotos de un spinner.

| Captura                     | Qué demuestra                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `01-panel-de-control.png`   | Se aterriza en la salud del worker, no en el formulario.                                         |
| `02-consola-escenarios.png` | El catálogo del motor gobierna la cabecera: proveedor, voz, formato, presupuesto y cupo por día. |
| `03-falta-una-variable.png` | Falta una variable ⇒ el botón no deja enviar y dice cuál. El motor las exige todas.              |
| `04-plantilla-lista.png`    | La vista previa compone la frase con lo escrito dentro, antes de gastar nada.                    |
| `05-en-cola.png`            | El estado intermedio existe y se ve: nada de una pantalla congelada mientras se procesa.         |
| `06-resultado-respaldo.png` | El desenlace se dice con todas las letras —«Se sirvió el respaldo»— y con su motivo.             |
| `07-resultado-oscuro.png`   | Lo mismo en tema oscuro: todo sale de tokens, nada quedó ilegible al conmutar.                   |

**Lo que estas capturas destaparon.** La primera corrida las dejó diciendo
«Coste: Se generó en esta ejecución» sobre una ejecución que había servido el
RESPALDO justo porque no se pudo generar nada — afirmaba un gasto que nunca
ocurrió. Son tres casos y no dos (caché, generado, ni lo uno ni lo otro), y así
está ahora en `costLabel()` con su prueba. No lo encontró ninguna aserción: lo
encontró mirar la foto.

En estas capturas el reproductor marca `0:00 / 0:00`, y no es un fallo de la
vista: con el proveedor `fake` el audio es un MP3 sintético sin tramas
decodificables. Con un proveedor real trae duración.

## Contra el motor REAL

Lo anterior prueba que la vista sabe pintar la forma que este repositorio CREE
que el motor sirve. Esto prueba que esa creencia es cierta.

Se corrió dos veces: primero contra el motor compilado en local con la API y el
worker en procesos separados, y después contra **las imágenes de Docker
reconstruidas** (`atlas-decision-engine-api` y `-worker`), que es el artefacto
que se despliega. En la segunda, el orquestador del contenedor lista el trabajo
nuevo junto a los otros tres:

```
Orquestador de trabajos activo: audio-tts, bank-statement, identity-verification,
outbox-relay, runtime-retention, semantic-analysis, semantic-retention, test-run
```

Ambas sobre la base de PostgreSQL local, con la migración
`20260811090000_audio_tts_worker` aplicada y el proveedor `fake`:

```
OK   el catálogo publica el worker de locución, disponible y con su proveedor
OK   el motor siembra el catálogo de plantillas y publica sus variables
OK   encolar responde 202 con la ejecución creada
OK   el worker de fondo la resuelve y GENERA el audio (no estaba en caché) — 554 bytes
OK   el audio se sirve por la ruta autenticada y son bytes de MP3 de verdad — audio/mpeg
OK   sin credencial el audio NO se sirve — HTTP 401
OK   repetir la MISMA locución devuelve la ejecución que ya existe, no una segunda
OK   la segunda vez sale de la CACHÉ: no se genera ni se paga otra vez
OK   una plantilla que no existe falla con su código y sin reintentar en bucle
OK   las métricas del worker se calculan sobre su propia tabla

10/10 comprobaciones en verde
```

La comprobación de las métricas **no afirma un número de ejecuciones**, y esa
fue una lección de la propia corrida: la idempotencia es por tenant y por
contenido, así que una locución repetida de una corrida anterior —incluso pedida
por otro actor— devuelve la fila que ya existía en vez de crear otra. Contar
filas ahí mediría cuántas veces se ha ejecutado la sonda, no si las métricas
funcionan.

**Lo que esta corrida destapó**, y que ninguna prueba unitaria podía ver: la
contabilidad del presupuesto ejecutaba SQL crudo fuera de `$transaction`. Sobre
una conexión del pool que ya había servido a un tenant, `app.tenant_id` queda
definido con cadena vacía y la política de RLS aborta con `22P02` — así que la
locución se quedaba «En cola» para siempre, y sólo a veces. Es la misma trampa
que documenta `worker-metrics.service.ts` del motor; corregida envolviendo las
cinco sentencias.

Una corrida intermedia terminó en `UNAVAILABLE` con «Se agotó el cupo de
locuciones de hoy para esta cuenta». No era un fallo: era el techo de tres
generaciones por actor y día haciendo exactamente su trabajo, y la degradación
llegando traducida hasta la pantalla.

## Con una voz REAL (ElevenLabs)

Todo lo anterior corre con el proveedor `fake`, que sintetiza un MP3 determinista
sin salir a la red. Eso demuestra el ciclo entero menos una cosa: que lo que sale
se pueda escuchar. La última corrida se hizo contra ElevenLabs, con el motor en
Docker y `AUDIO_TTS_PROVIDER=elevenlabs`:

```
OK   el catálogo publica el worker de locución, disponible y con su proveedor — provider: elevenlabs
OK   el worker de fondo la resuelve y GENERA el audio (no estaba en caché) — SUCCEEDED · QUEUED · 104951 bytes
OK   el audio se sirve por la ruta autenticada y son bytes de MP3 de verdad — 104951 bytes · audio/mpeg
OK   la segunda vez sale de la CACHÉ: no se genera ni se paga otra vez — READY · cacheHit=true

10/10 comprobaciones en verde
```

**105 KB frente a los 554 bytes del sintético**: eso es voz de verdad, y es la
diferencia que ninguna aserción sobre el código podía dar por sí sola.

Tres cosas que la configuración real enseñó, y que conviene saber antes de
repetirla:

- **La cuenta gratuita no puede usar voces de biblioteca por API.** El proveedor
  responde `402 paid_plan_required`, no un error de credencial, así que se
  diagnostica mal si uno sólo mira «falló la clave». Hay que usar una voz
  predeterminada.
- **El modelo por omisión del paquete (`eleven_v3`) no lo sirve cualquier
  cuenta.** Se fija `ELEVENLABS_MODEL_ID=eleven_multilingual_v2`, que responde en
  español. La variable existía justamente para esto.
- **Una clave con permisos recortados sigue sirviendo.** La usada no podía leer
  usuario ni voces (`missing_permissions`) y aun así locutaba: el motor sólo
  necesita el permiso de síntesis. Pedir más de lo necesario es lo que no hace
  falta.

Cambiar de proveedor cambia la **identidad** de los assets —`provider` entra en
la huella—, así que nada de lo generado con `fake` se reutiliza. Es lo correcto:
servir con la voz nueva un audio calculado con la vieja sería justo el error que
esa huella existe para impedir.

Las credenciales viven en `AtlasDecisionEngine/.env`, que está en `.gitignore`.
**No se escriben en el repositorio ni en esta evidencia.**
