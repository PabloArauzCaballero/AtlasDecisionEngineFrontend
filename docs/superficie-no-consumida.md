# Superficie del motor que el portal no consume

Cada operación que el motor publica en su OpenAPI y ninguna vista del portal
llama tiene que estar aquí, con **motivo** y **responsable**. Lo verifica
`scripts/engine-surface.mjs` dentro de `yarn verify:source`.

La lista no es un permiso: es una deuda anotada. Una operación sin fila pone la
CI en rojo, y una fila cuya operación ya se consume también — una lista con
deuda saldada dentro deja de leerse, y entonces vuelve a pasar lo que la hizo
necesaria.

## Por qué existe este archivo

El motor publicaba desde hacía meses las cinco operaciones de
`v1/model-monitoring` —desenlaces observados, atributos para medir sesgo,
desempeño, estabilidad de población e impacto adverso— y las dos de
`v1/data-subject-requests`. El portal no llamaba a ninguna. La capacidad
existía, nadie la veía, nadie la usaba, y ninguna prueba de extremo a extremo
pasaba por ahí, así que tampoco se habría notado si dejaba de funcionar.

Un endpoint sin pantalla no es «trabajo pendiente»: es trabajo hecho que se
pierde en silencio. Este archivo hace ruidoso ese silencio.

## Cómo se actualiza

```bash
# Regenerar el inventario (necesita el motor en ../AtlasDecisionEngine)
node scripts/engine-surface.mjs --generar

# Ver qué falta, en el formato de fila de esta tabla
node scripts/engine-surface.mjs --informe
```

## Deuda saldada que conviene recordar

`POST /v1/model-monitoring/outcomes` estuvo exento con un argumento bueno: la carga la hace el
libro de préstamos por cosecha, y **una pantalla para teclear desenlaces a mano produce una
muestra sesgada hacia lo que alguien se acordó de cargar**. El argumento sigue siendo cierto y
por eso el camino principal sigue siendo el lote (`POST /v1/outcomes/batch`), que ejecuta la
conciliación.

Lo que cambió es que ahora existe la **cola de ventanas vencidas**: la pantalla no ofrece un
formulario en blanco, ofrece la lista completa de lo que falta por observar, ordenada por
antigüedad. Sobre esa lista no se puede elegir qué cargar y qué no —está todo a la vista— así
que el sesgo que motivaba la exención no puede producirse. Y quedaban dos casos que el lote
nunca va a traer: el fraude confirmado, que llega de uno en uno, y la corrección de una
observación equivocada. `INDETERMINATE` es una opción de primera clase por lo mismo: registrar
«no se sabe» distingue el caso mirado del caso olvidado.

### Reversión y suspensión de despliegues (saldada el 13/08/2026)

`POST /v1/deployments/{id}/rollback` y `/suspend` estuvieron exentas con la nota «deuda real y
sensible: hoy una reversión sólo se puede hacer fuera del portal, sin el registro que el portal
aporta». Era exacta, y describía la peor de las siete lagunas: el momento en que más importa
saber quién decidió qué es justamente el incidente, y ahí la respuesta era «alguien, desde algún
sitio».

Ya no. Las dos son acciones por fila en el historial de despliegues, sólo sobre despliegues
vivos, sólo para `PLATFORM_ADMIN`, y con **motivo obligatorio** —el motor lo exige y el diálogo
no deja accionar sin él—. El diálogo dice la consecuencia antes de actuar y distingue las dos
cosas, que se parecen y no son iguales: revertir devuelve el ambiente al despliegue anterior,
suspender lo deja SIN versión activa. Y dice lo que NO cambia: lo ya decidido no se reescribe.

### Integridad de la cadena de auditoría (saldada el 13/08/2026)

`GET /v1/audit/chain/verify` y `GET /v1/audit/metrics` estaban exentas, la primera con esta
nota: «sin pantalla: hoy sólo se puede verificar por consola, que es justo donde no mira quien
audita». Una cadena de hashes que nadie comprueba no es una garantía, es una promesa — y las
promesas no se presentan ante un regulador.

Ahora encabezan `/audit-events`, antes de la lista y no al pie: quien entra viene a mirar hechos
registrados, y lo primero que hay que poder afirmar es que ese registro no fue alterado.

La presentación distingue TRES estados y no dos, por lo mismo que las pantallas de medición:
«no se pudo comprobar» (`HASH_KEY_UNAVAILABLE`, falta el secreto de firma) no es «está mal». En
rojo mandaría a investigar una manipulación que no ocurrió; en verde escondería que no se
comprobó nada. Y cero eventos sale en neutro: una cadena íntegra por vacía no es una cadena
verificada.

### Exportación del informe de revisión de seguridad (nunca fue deuda)

Estuvo en esta lista por un defecto del propio gate, no del portal: el botón existía desde hacía
tiempo en `/security-review/[versionId]`, pero la ruta se construía como `` `${path}/export` `` y
`scripts/engine-surface.mjs` sólo sigue la pista hasta el literal `/v1/…` del mismo archivo. Veía
`/v1/security-review/versions/{p}` y no veía `/…/export`.

Es la trampa que el `CLAUDE.md` ya advierte —«escribe la ruta entera»— vista desde el otro lado:
allí el riesgo es dar por consumidas operaciones vecinas que nadie mira; aquí fue dar por NO
consumida una que sí. Se escribe entera y desaparece de la lista.

### Asignación de revisión manual y propiedades de QA Lab (saldadas el 13/08/2026)

`POST /v1/manual-reviews/{id}/assign` tenía incluso el botón puesto, deshabilitado, con el
título «aún no está expuesta por el Decision Engine». Lo estaba. El flujo se podía RESOLVER
desde el portal pero no ASIGNAR, así que la mitad que decide quién mira cada caso ocurría fuera
y no dejaba traza. Se asigna al correo de la sesión y no a un campo libre: el caso de uso que
faltaba es «tomo yo este caso», y un selector de personas invita a repartir trabajo ajeno desde
una pantalla que no es la de gestión de colas.

`GET /v1/qa-lab/properties` sustituye al mapa fijado en cliente, que es la misma clase de fallo
que el gate persigue una capa más adentro: el motor gana una comprobación —y empieza a
encontrar una clase entera de defectos— y el portal la enseña con su código crudo donde debería
ir la explicación. El mapa local se queda como RESPALDO, no como duplicado: un catálogo remoto
caído no puede llenar la pantalla de `OUTPUT_TYPES_MATCH_CONTRACT`, porque entonces la caída del
catálogo se lee como un defecto del artefacto que se estaba revisando.

### Un solo diff de versiones (saldada el 13/08/2026)

`GET /v1/artifact-versions/{izq}/diff/{der}` estaba exento con esta nota: «el portal calcula la
comparación en cliente. Deuda real: dos implementaciones del mismo diff que pueden discrepar».
En un artefacto de gobierno, dos respuestas distintas a «qué cambió» es peor que ninguna: las
dos parecen autoritativas y no hay forma de saber cuál mentía.

**La salida no fue borrar el código del cliente**, y la razón importa. El motor compara a nivel
de ENTIDAD (añadida, quitada, cambiada, con su `before` y su `after`); la pantalla de revisión
enseña el detalle CAMPO A CAMPO y separa lo cosmético de lo que altera la decisión. Sustituir lo
segundo por lo primero habría cambiado un problema de coherencia por uno de información: el
revisor vería «este nodo cambió» sin saber si se movió de sitio o si le cambiaron el umbral.

El reparto que queda: **qué cambió lo decide el motor** —es quien tiene la verdad canónica y
calcula los checksums— y **cómo se explica lo hace el portal**, sobre el `before`/`after` que el
motor entregó. Eso es formatear una respuesta, no emitir una segunda opinión: sobre los mismos
dos objetos no puede salir un veredicto distinto. De paso, una petición en vez de dos.

### Preludios de las librerías aprobadas (saldada el 13/08/2026)

Exento como «deuda menor», y era menor sólo en esfuerzo. En consecuencia no: el registro decía
qué librerías están aprobadas y no qué se puede escribir con ellas. Quien iba a redactar el
script de un nodo tenía la lista de paquetes y ninguna forma de saber si `npv` existe — salvo
escribirlo, guardar, ejecutar y ver si el sandbox lo rechaza. Eso convierte una consulta de dos
segundos en un ciclo de prueba y error sobre un artefacto de decisión.

Se muestran por LENGUAJE y no fusionados, y ahí está el detalle que importa: una librería puede
tener implementación en Python y no en JavaScript. Fusionarlas ofrecería funciones que en el
lenguaje elegido no existen, que es exactamente el error que el panel viene a evitar. Y `null`
—sin implementación— se distingue de `[]` —implementada y sin funciones expuestas—, porque no
son lo mismo.

## Exenciones vigentes

| Operación                                     | Motivo                                                                                                                                                                                                                                                                       | Responsable |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `GET /health`                                 | Sondeo de infraestructura: lo consulta el orquestador, no una persona.                                                                                                                                                                                                       | plataforma  |
| `GET /health/data-sources`                    | Diagnóstico de dependencias del motor; se mira desde el motor, no desde el portal.                                                                                                                                                                                           | plataforma  |
| `GET /health/live`                            | Sonda de vida de Kubernetes.                                                                                                                                                                                                                                                 | plataforma  |
| `GET /health/ready`                           | Sonda de disponibilidad de Kubernetes.                                                                                                                                                                                                                                       | plataforma  |
| `GET /ready`                                  | Alias heredado de la sonda de disponibilidad.                                                                                                                                                                                                                                | plataforma  |
| `POST /pdf/generate`                          | El worker de PDF es un servicio aparte que comparte documento OpenAPI; el portal no genera documentos.                                                                                                                                                                       | plataforma  |
| `POST /pdf/generate/async`                    | Ídem: superficie del worker de PDF.                                                                                                                                                                                                                                          | plataforma  |
| `GET /pdf/health`                             | Ídem: sonda del worker de PDF.                                                                                                                                                                                                                                               | plataforma  |
| `POST /pdf/preview`                           | Ídem: superficie del worker de PDF.                                                                                                                                                                                                                                          | plataforma  |
| `GET /pdf/templates`                          | Ídem: superficie del worker de PDF.                                                                                                                                                                                                                                          | plataforma  |
| `GET /pdf/templates/{p}`                      | Ídem: superficie del worker de PDF.                                                                                                                                                                                                                                          | plataforma  |
| `GET /pdf/templates/{p}/schema`               | Ídem: superficie del worker de PDF.                                                                                                                                                                                                                                          | plataforma  |
| `POST /pdf/templates/{p}/validate`            | Ídem: superficie del worker de PDF.                                                                                                                                                                                                                                          | plataforma  |
| `GET /pdf/templates/{p}/versions`             | Ídem: superficie del worker de PDF.                                                                                                                                                                                                                                          | plataforma  |
| `GET /pdf/admin/templates`                    | Administración de plantillas del worker de PDF: servicio aparte con su propio panel.                                                                                                                                                                                         | plataforma  |
| `POST /pdf/admin/templates`                   | Ídem: administración del worker de PDF.                                                                                                                                                                                                                                      | plataforma  |
| `DELETE /pdf/admin/templates/{p}/{p}`         | Ídem: administración del worker de PDF.                                                                                                                                                                                                                                      | plataforma  |
| `POST /pdf/admin/templates/{p}/{p}/deprecate` | Ídem: administración del worker de PDF.                                                                                                                                                                                                                                      | plataforma  |
| `GET /pdf/admin/templates/{p}/{p}/source`     | Ídem: administración del worker de PDF.                                                                                                                                                                                                                                      | plataforma  |
| `GET /pdf/errors`                             | Catálogo de errores del worker de PDF, para quien integra contra él.                                                                                                                                                                                                         | plataforma  |
| `GET /pdf/template-format/example`            | Documentación del formato de plantilla del worker de PDF.                                                                                                                                                                                                                    | plataforma  |
| `GET /pdf/template-format/schema`             | Ídem: documentación del worker de PDF.                                                                                                                                                                                                                                       | plataforma  |
| `POST /v1/decisions/{p}`                      | La ejecución real la piden los sistemas integradores. El portal decide por el simulador y por la ejecución en vivo, que no persisten.                                                                                                                                        | riesgo      |
| `GET /v1/audit/events/cursor`                 | Paginación por cursor; las tablas del portal paginan por página. Se consumiría al pasar el registro de auditoría a desplazamiento infinito.                                                                                                                                  | portal      |
| `GET /v1/code-imports/{p}`                    | El detalle se conserva en memoria desde la respuesta del análisis; nunca se vuelve a pedir. Se necesitará al reanudar una importación entre sesiones.                                                                                                                        | portal      |
| `POST /v1/model-monitoring/attributes`        | Los atributos de sesgo sólo los puede cargar `COMPLIANCE`, y a propósito: son el dato que la normativa prohíbe usar al decidir, y quien lo carga no debe ser quien diseña el artefacto. Sin pantalla mientras la carga siga siendo un proceso de auditoría fuera del portal. | gobierno    |
| `GET /v1/views/scripts`                       | Vista de lectura de los scripts de nodo; el editor los trae con el grafo.                                                                                                                                                                                                    | portal      |
