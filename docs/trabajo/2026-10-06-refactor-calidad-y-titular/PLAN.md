# Plan — Refactorización de «Calidad de la decisión» y «Derechos del titular»

- Fecha: 2026-10-06 · Repos afectados: AtlasDecisionEngineFrontend, AtlasDecisionEngineBackend,
  AtlasBackend (Core) · Predecesor: retiro de «Ejecución en vivo» (misma rama)
- Resultado observable: un analista de riesgo abre cada vista en TEST y lee algo accionable
  (o un vacío que le dice qué falta y quién lo provee), sin teclear identificadores internos.
- Kill-test: entrar con un usuario de riesgo a `/decision-quality` y `/data-subject-requests`
  en TEST. Si alguna pestaña muestra «sin datos» sin decir por qué, o pide un número de
  versión, despliegue o ejecución, esto NO está hecho.

## Estado actual

Las dos vistas **salieron del menú** el 2026-10-06 porque no mostraban nada relevante. Las
rutas, las páginas y los endpoints siguen igual: el refactor se hace sobre ese código y la
entrada del menú vuelve cuando el hito correspondiente esté en `HECHO`.

## Diagnóstico (descubrimiento, peldaño `DISCOVERED`)

Rutas: FE = AtlasDecisionEngineFrontend, BE = AtlasDecisionEngineBackend, CORE = AtlasBackend.

### Calidad de la decisión

1. **Los datos de origen se generan solo con condiciones que casi nunca se cumplen juntas.**
   - Las ventanas de observación se crean únicamente si la decisión trae sujeto **y** el
     despliegue tiene `riskDomain = CREDIT_ORIGINATION`
     (BE `runtime/execution-writer.service.ts:263-282`, `runtime/outcome-windows.ts:28-29`).
   - «Pendientes» exige `due_at <= now()`, así que nada aparece antes de 30 días
     (BE `outcome-ingestion/vintage.service.ts:131-145`).
   - «Cosechas» exige créditos dados de alta (`facility_id`), y solo CORE los registra
     (BE `vintage.service.ts:77-90`).
   - «Punto de corte» exige al menos 10 desenlaces observados a 90 días y un `score` numérico
     en el primer nivel. Si el score no es numérico, la consulta responde 500
     (BE `model-monitoring/cutoff-analysis.service.ts:66-89`).
2. **CORE es el único productor, y solo si está configurado.**
   - El alta de créditos y la carga de desenlaces no hacen nada sin
     `DECISION_ENGINE_OUTCOME_API_KEY` y la URL base (CORE `decision-engine.client.ts:35-37`,
     `outcome-dispatch.service.ts:49-51`, `facility-registration.service.ts:53`). La clave
     solo es obligatoria en producción (`config/env.decision-engine.checks.ts:45`).
   - La identidad móvil no envía `subjectReference` (CORE `mobile-identity.service.ts:199-212`).
3. **Error: cargar un desenlace desde la cola no la cierra.**
   - `POST /v1/model-monitoring/outcomes` no marca `outcome_window_schedule.observed_at`
     (BE `model-monitoring.service.ts:72-92`). Solo lo hace la ingesta por lote
     (`outcome-ingestion.service.ts:263`).
   - El caso sigue en la cola y la cobertura no se mueve.
4. **Los errores se pintan como vacíos o como «todo bien».**
   - PendingWindowsPanel muestra «Ninguna ventana vencida» cuando la petición falló
     (FE `PendingWindowsPanel.tsx:44-50`).
   - VintageMatrix muestra «Todavía no hay cosechas» ante un error (`VintageMatrix.tsx:35-45`).
   - CutoffPanel no tiene rama de error.
   - El rol OPERATIONS entra a la vista (FE `access-policies.ts:63-64`), pero el motor le
     responde 403 en cosechas, corte y A/B (BE `outcome-ingestion.controller.ts:84`,
     `model-monitoring.controller.ts:87,112`). Esos 403 se ven como «sin datos».
5. **Pide identificadores internos.** Versión `4001`, despliegue `912`, ejecución `88001` y
   un nombre de campo de score escrito a mano (FE `CutoffPanel.tsx:91-141`,
   `DecisionQualityPage.tsx:138-148`, `FacilityRegistrationPanel.tsx:80-86`). Los selectores
   que ya existen (`/v1/views/pickers/*`, los usa Monitoreo del modelo) no se usan aquí.

### Derechos del titular

1. **La consulta exige una referencia que el operador no puede conocer.**
   - El motor aplica HMAC a la `subjectReference` escrita en claro
     (BE `data-subject.service.ts:127-149`).
   - En crédito, esa referencia es `sha256(salt|tenant|purpose|customerId)` y la sal vive solo
     en CORE (CORE `subject-reference.service.ts:34-37`).
   - Cualquier otro texto devuelve 0 decisiones y aun así queda guardado como `FULFILLED`
     (BE `data-subject.service.ts:182-191`).
2. **No está conectada con el flujo real de derechos.** El ARCO de CORE
   (`customer-privacy.controller.ts:91`) nunca llama al motor.
   - ERASURE siempre termina `REJECTED`.
   - REVIEW dice «cola de revisión manual», pero no encola nada (BE `data-subject.service.ts:192-217`).
   - No existe rectificación.
3. **Detalles menores.**
   - El cuerpo de `/history` no se valida (BE `data-subject.controller.ts:52`).
   - La tabla muestra el `executionId` crudo (FE `DataSubjectResult.tsx:69-84`).

### Pruebas

- FE: no hay ninguna unitaria de comportamiento, y el E2E corre contra un mock vacío o fijo.
- BE: no hay ninguna spec del SQL de cobertura, cosechas, pendientes ni corte.

## Alcance

- IN: las dos vistas (FE), sus endpoints (BE), la configuración y el envío de sujeto y
  desenlaces desde CORE, y los datos sintéticos de TEST declarados como tales.
- OUT: el modelo de riesgo, los umbrales de monitoreo, la vista «Monitoreo del modelo», y
  rectificación de datos en el motor (requiere decisión de negocio, ver ambigüedades).
- Ambigüedades registradas (confirmar con Pablo Arauz):
  - A1. ¿Los derechos del titular se gestionan desde CORE (ARCO) y el motor solo responde, o
    también desde este portal? Supuesto: **CORE es la puerta**. El motor expone la consulta
    y el portal del motor la lee por `customerId` resuelto en CORE, no por la referencia en claro.
  - A2. ¿TEST debe tener desenlaces sintéticos para que las vistas se puedan mirar antes de
    90 días? Supuesto: **sí, marcados como demo** (regla 97.6.3), nunca mezclados con observados.
  - A3. ¿Qué debe pasar con ERASURE en el motor (rechazo legal por retención vs borrado
    del vínculo)? → decisión de negocio/cumplimiento (`DECISION_REQUIRED`).

## H1 — Calidad de la decisión dice la verdad sobre su propio estado

**CA:** Dado un usuario de riesgo en TEST, cuando abre cualquier pestaña, entonces ve datos,
o un vacío que dice qué falta (sujeto, despliegue de originación, ventanas aún no vencidas,
CORE sin clave), o un error accionable. Nunca un «todo bien» falso.
**DoD:** `yarn verify` (FE) y `yarn test` (BE) en verde · E2E con datos densos y con errores
PASS · capturas en 3 viewports × 2 temas · vuelve la entrada al menú.
**Estado:** TODO

### H1.S1 — Corrección del circuito (BE)

| ID       | Microtarea                                                                                     | CA (binario)                                                        | DoD                                             | Estado |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------- | ------ |
| H1.S1.M1 | `POST /v1/model-monitoring/outcomes` cierra la ventana (`observed_at`) en la misma transacción | Tras cargar un desenlace, la ventana sale de `/v1/outcomes/pending` | spec de integración contra Postgres real → PASS | TODO   |
| H1.S1.M2 | Corte con `score` no numérico responde 400 de contrato, no 500                                 | Score de texto → 400 `SCORE_NOT_NUMERIC`                            | spec de controller → PASS                       | TODO   |
| H1.S1.M3 | Specs SQL de cobertura, pendientes y cosechas                                                  | Los tres devuelven lo esperado sobre datos sembrados                | `yarn test outcome-ingestion` → PASS            | TODO   |
| H1.S1.M4 | Cobertura informa el «porqué» del vacío (sin sujeto, sin originación, sin ventanas vencidas)   | La respuesta trae `emptyReason`                                     | spec + OpenAPI actualizado                      | TODO   |

### H1.S2 — Productor real de datos (CORE)

| ID       | Microtarea                                                                                  | CA (binario)                                             | DoD                                         | Estado |
| -------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- | ------ |
| H1.S2.M1 | `DECISION_ENGINE_OUTCOME_API_KEY` obligatoria también en TEST, y el arranque falla si falta | Arrancar TEST sin la clave → error de configuración      | test de `env.decision-engine.checks` → PASS | TODO   |
| H1.S2.M2 | Los jobs de alta y desenlaces dejan un registro visible cuando no hacen nada                | Último éxito o motivo de «no-op» visible en runtime-jobs | test de job → PASS                          | TODO   |
| H1.S2.M3 | Decidir si la identidad móvil debe llevar sujeto (A1)                                       | Decisión registrada                                      | ADR o nota en PLAN                          | TODO   |

### H1.S3 — Datos de TEST (A2)

| ID       | Microtarea                                                                                                                 | CA (binario)               | DoD                               | Estado |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------- | ------ |
| H1.S3.M1 | Seed demo idempotente: decisiones de originación con sujeto, créditos, ventanas vencidas y desenlaces, todos marcados demo | 2ª corrida inserta 0 filas | salida de las dos corridas pegada | TODO   |

### H1.S4 — Interfaz (FE)

| ID       | Microtarea                                                                                                      | CA (binario)                                                        | DoD                                        | Estado |
| -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ | ------ |
| H1.S4.M1 | Rama de error real en Pendientes, Cosechas, Corte y Cobertura                                                   | Un 500 o 403 mockeado → mensaje accionable, nunca «ninguna ventana» | unit + E2E de errores → PASS               | TODO   |
| H1.S4.M2 | Alinear roles: OPERATIONS no ve pestañas que el motor le niega (o el BE se las abre)                            | Sin 403 en ninguna pestaña para ningún rol admitido                 | matriz de roles en E2E → PASS              | TODO   |
| H1.S4.M3 | Selectores de artefacto/versión/despliegue (`/v1/views/pickers/*`) en lugar de IDs                              | Ningún campo pide un número interno                                 | E2E con `dense-backend` → PASS             | TODO   |
| H1.S4.M4 | Alta de crédito por búsqueda de decisión (no `executionId` crudo), o retirarla si CORE es el único que da altas | Decisión tomada y aplicada                                          | E2E → PASS                                 | TODO   |
| H1.S4.M5 | Textos sin jerga (ventana, cosecha, champion/challenger) y vacíos que orientan                                  | Revisión de microcopy aprobada                                      | captura + checklist `ux-writing-microcopy` | TODO   |
| H1.S4.M6 | Volver a poner la entrada en el menú                                                                            | Visible para los roles de `decisionQuality`                         | `yarn verify` + captura                    | TODO   |

## H2 — Derechos del titular funciona desde el caso real

**CA:** Dado un pedido de derechos de un cliente, cuando el operador lo busca por el cliente
(no por un hash), entonces ve las decisiones automatizadas que lo afectaron, y el pedido queda
registrado con un estado que corresponde a lo que el sistema hizo de verdad.
**DoD:** E2E contra el motor real con un cliente sintético · matriz de autorización negativa ·
sin PII en logs ni URL · gate `data-privacy-sensitive` · vuelve la entrada al menú.
**Estado:** TODO (H2.S1 requiere A1 resuelta)

### H2.S1 — Resolver la referencia del sujeto (CORE ↔ BE)

| ID       | Microtarea                                                                                       | CA (binario)                                                     | DoD                             | Estado |
| -------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------- | ------ |
| H2.S1.M1 | CORE expone la resolución cliente → `subjectReference` (servidor a servidor, nunca al navegador) | Con el `customerId` se obtiene la referencia que usó la decisión | test de servicio en CORE → PASS | TODO   |
| H2.S1.M2 | El ARCO de CORE consulta al motor y adjunta el resultado al pedido                               | Un pedido ACCESS en CORE muestra las decisiones del motor        | test de integración → PASS      | TODO   |
| H2.S1.M3 | Un texto que no corresponde a ningún sujeto no se registra como `FULFILLED`                      | Sin coincidencias → `NO_MATCH`, distinguible de «sin decisiones» | spec BE → PASS                  | TODO   |

### H2.S2 — Estados honestos (BE)

| ID       | Microtarea                                                       | CA (binario)                             | DoD                    | Estado                              |
| -------- | ---------------------------------------------------------------- | ---------------------------------------- | ---------------------- | ----------------------------------- |
| H2.S2.M1 | REVIEW encola de verdad en revisión manual, o deja de prometerlo | El texto coincide con el efecto          | spec BE → PASS         | TODO                                |
| H2.S2.M2 | ERASURE según A3                                                 | Comportamiento acordado con cumplimiento | spec BE + nota legal   | BLOQUEADO (`DECISION_REQUIRED`: A3) |
| H2.S2.M3 | Validar el cuerpo de `/history` (DTO con lista blanca)           | Campo extra → 400                        | spec controller → PASS | TODO                                |

### H2.S3 — Interfaz (FE)

| ID       | Microtarea                                                                                                         | CA (binario)                     | DoD                           | Estado |
| -------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ----------------------------- | ------ |
| H2.S3.M1 | Búsqueda por cliente (vía CORE) en vez de referencia en claro, o mover la vista al Portal admin de CORE (según A1) | El operador no escribe un hash   | E2E → PASS                    | TODO   |
| H2.S3.M2 | La tabla muestra artefacto, fecha y desenlace, con enlace al detalle, y no el `executionId` crudo                  | Sin IDs crudos visibles          | captura 3 viewports × 2 temas | TODO   |
| H2.S3.M3 | Volver a poner la entrada en el menú                                                                               | Visible para `dataSubjectRights` | `yarn verify` + captura       | TODO   |

## Orden propuesto

1. H1.S1 (bugs del motor) y H1.S4.M1–M2 (errores y roles): no dependen de ninguna decisión.
2. H1.S2 y H1.S3: datos reales y demo en TEST.
3. H1.S4.M3–M6: interfaz y vuelta al menú.
4. A1/A3 resueltas, luego H2.

## Riesgos y bloqueos previstos

| Riesgo                                                                              | Impacto                            | Mitigación                                                    |
| ----------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Sin desenlaces reales durante 90 días, Corte y Cosechas siguen vacíos en producción | La vista vuelve a parecer inútil   | Vacío que explica cuándo habrá datos; seed demo solo en TEST  |
| Datos demo confundidos con observados                                               | Calibración falsa                  | Marca demo explícita, excluida de métricas de producción      |
| Exponer la resolución cliente → referencia                                          | Filtra un identificador pseudónimo | Solo servidor a servidor, auditado, nunca en URL ni navegador |
