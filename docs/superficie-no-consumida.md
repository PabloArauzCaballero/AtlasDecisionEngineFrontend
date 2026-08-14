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
| `GET /v1/artifact-versions/{p}/diff/{p}`      | El portal calcula la comparación en cliente (`features/governance/version-diff.ts`). Deuda real: dos implementaciones del mismo diff que pueden discrepar.                                                                                                                   | gobierno    |
| `GET /v1/audit/chain/verify`                  | Comprobación de integridad de la cadena de auditoría. Sin pantalla: hoy sólo se puede verificar por consola, que es justo donde no mira quien audita.                                                                                                                        | gobierno    |
| `GET /v1/audit/events/cursor`                 | Paginación por cursor; las tablas del portal paginan por página. Se consumiría al pasar el registro de auditoría a desplazamiento infinito.                                                                                                                                  | portal      |
| `GET /v1/audit/metrics`                       | Métricas agregadas de auditoría. Sin pantalla que las presente todavía.                                                                                                                                                                                                      | gobierno    |
| `GET /v1/code-imports/{p}`                    | El detalle se conserva en memoria desde la respuesta del análisis; nunca se vuelve a pedir. Se necesitará al reanudar una importación entre sesiones.                                                                                                                        | portal      |
| `POST /v1/deployments/{p}/rollback`           | Sin pantalla. Deuda real y sensible: hoy una reversión sólo se puede hacer fuera del portal, sin el registro que el portal aporta.                                                                                                                                           | gobierno    |
| `POST /v1/deployments/{p}/suspend`            | Ídem: suspender un despliegue no tiene control en la interfaz.                                                                                                                                                                                                               | gobierno    |
| `POST /v1/model-monitoring/attributes`        | Los atributos de sesgo sólo los puede cargar `COMPLIANCE`, y a propósito: son el dato que la normativa prohíbe usar al decidir, y quien lo carga no debe ser quien diseña el artefacto. Sin pantalla mientras la carga siga siendo un proceso de auditoría fuera del portal. | gobierno    |
| `GET /v1/libraries/preludes`                  | Los preludios de las librerías aprobadas no se muestran en el registro. Deuda menor.                                                                                                                                                                                         | riesgo      |
| `POST /v1/manual-reviews/{p}/assign`          | Un caso se puede resolver desde el portal pero no asignar; la asignación se hace fuera. Deuda real del flujo de revisión.                                                                                                                                                    | gobierno    |
| `GET /v1/qa-lab/properties`                   | El formulario de QA Lab lleva el catálogo de propiedades fijado en cliente, así que una propiedad nueva del motor no aparece sola.                                                                                                                                           | riesgo      |
| `GET /v1/security-review/versions/{p}/export` | La exportación del informe de revisión de seguridad no tiene botón.                                                                                                                                                                                                          | gobierno    |
| `GET /v1/views/scripts`                       | Vista de lectura de los scripts de nodo; el editor los trae con el grafo.                                                                                                                                                                                                    | portal      |
