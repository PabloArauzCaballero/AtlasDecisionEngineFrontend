# Plan: llevar el motor de decisión a microcrédito sostenido en el tiempo

> **Estado: implementado (2026-08-12).** Las siete olas están en el código. Lo que sigue es el
> diseño con su razonamiento; para el mapa de lo que existe hoy, los `CLAUDE.md` de los dos
> repositorios son la referencia viva.
>
> Piezas entregadas, por si se busca el código: gate de superficie
> (`scripts/engine-surface.mjs`); sujeto, crédito y ventanas
> (`runtime/subject-policy.ts`, `runtime/outcome-windows.ts`, migración
> `20260811120000`); ingesta y cosechas (`modules/outcome-ingestion/`); vigilancia
> (`model-monitoring/discrimination.ts`, `monitoring-thresholds.ts`,
> `monitoring-evaluator.service.ts`); frescura (`variables/freshness.ts`); economía, cartera y
> gobierno (`modules/risk-governance/`, migraciones `20260812010000` y `20260812020000`);
> pantallas `/decision-quality`, `/risk-governance` y `/data-subject-requests`.
>
> **Nada queda pendiente.** La resolución remota de variables ya existía
> (`VARIABLE_BACKEND_URL` en `variable-resolution.service.ts`); lo que faltaba —y ya está— es que
> la frescura se IMPONGA sobre lo que llega: `variableMetadata` en la petición, sello por variable
> en la traza, `VARIABLE_STALE` cuando el compromiso se incumple y `degraded_inputs` cuando se
> acepta un dato viejo.
>
> En la segunda pasada se cerró además lo que estaba construido y no llamaba nadie: la captura de
> línea base al promover, el PSI/desempeño/impacto adverso dentro del evaluador programado, el
> guardia de decisión (límites y consentimiento en el camino caliente), el gate del contrato
> económico al promover a producción, y los endpoints de punto de corte y comparación A/B.

Alcance: `AtlasDecisionEngine` (motor, NestJS + Prisma) y `AtlasDecisionEngineFrontend`
(portal, Next.js 16). Se menciona `AtlasAdminPortal` sólo donde viven los workers que
producen señal (extracto bancario, análisis semántico).

Este documento no propone un motor nuevo. Propone **cerrar el circuito** de uno que ya
tiene casi todas las piezas y las tiene desconectadas.

---

## 0. Qué se midió antes de escribir esto

Todo lo que sigue está verificado en el código, no inferido:

| Hallazgo                                                                                     | Dónde                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `subjectReference` es **opcional** en la petición de ejecución                               | `src/modules/runtime/runtime.dto.ts:8`                        |
| El sujeto se persiste como HMAC de una vía                                                   | `src/modules/runtime/execution-writer.service.ts:77`          |
| Existe la tabla de desenlaces observados, con ventana y etiqueta                             | `prisma/schema.prisma` → `DecisionOutcomeObservation`         |
| Existe la tabla de atributos sólo-para-medir-sesgo                                           | `prisma/schema.prisma` → `DecisionMonitoringAttribute`        |
| Existen PSI, resumen de desempeño y ratios de impacto adverso                                | `src/modules/model-monitoring/monitoring-analytics.ts`        |
| Existen 5 endpoints de monitoreo y 2 de titular de datos                                     | `v1/model-monitoring/*`, `v1/data-subject-requests`           |
| **El portal no llama a ninguno de los siete**                                                | 0 coincidencias de `v1/model-monitoring` \| `v1/data-subject` |
| `freshnessSlaSeconds` se declara, se lee en DTOs y semillas, y **no se impone en ejecución** | sólo `artifact-graph-reader`, `*.response.dto`, `seeding/`    |
| El runtime **no resuelve variables desde proveedores**: todo llega en la petición            | `runtime.service.ts` / `execution-writer.service.ts`          |
| Ya hay un grafo de cobranza como demo, con `current_delinquency_bucket`                      | `src/modules/seeding/data/collections-demo.graph.ts`          |
| Hay barrido de retención programado                                                          | `src/modules/runtime/retention-sweeper.service.ts`            |
| Hay bus de eventos con `MODEL_OUTCOMES_RECORDED` y `DECISION_EXECUTED`                       | `DecisionOutboxEvent` + `outbox-relay`                        |
| Hay OpenAPI generado y verificado en CI                                                      | `openapi/openapi.json`, `yarn docs:openapi:check`             |

---

## 1. El diagnóstico, en una frase

El motor sabe **decidir** y sabe **gobernarse**; no sabe todavía **si acierta**, y no
sabe **quién es** el que tiene delante salvo que el llamante se acuerde de decírselo.

Los tres modos de fallo que lo mantienen así:

1. **La identidad del sujeto es opcional.** Un campo opcional del que dependen el
   historial, los desenlaces, la exposición y los derechos del titular es, en la
   práctica, un campo vacío. Todo lo construido encima queda inerte y nadie ve el
   error: las consultas devuelven cero filas, que es indistinguible de «no hubo».
2. **El lazo de retroalimentación tiene entrada pero no tiene tubería.**
   `POST /v1/model-monitoring/outcomes` existe. Nada lo alimenta: no hay conciliación
   con el sistema de cartera, no hay planificador, no hay reintento, no hay medida de
   cuántas decisiones elegibles siguen sin observar.
3. **Lo que no se ve, se atrofia.** Siete endpoints sin una sola pantalla que los use.
   Una capacidad invisible no se usa, y una capacidad que no se usa se rompe sin que
   nadie lo note, porque ninguna prueba de extremo a extremo pasa por ahí.

De estos tres, el tercero es el que hace que el problema **vuelva**. Por eso la Ola 7 no
es documentación: es un gate.

---

## 2. Principio rector

**Cada ola entrega su propio mecanismo de verificación permanente.** No se da por
terminada una ola porque el código exista, sino porque existe algo que se pone rojo si
la capacidad deja de funcionar. El repositorio ya trabaja así (`verify-conventions.mjs`,
`verify-source.mjs`, contraste medido sobre el DOM, E2E contra el motor real); esto lo
extiende al circuito de decisión.

Corolario operativo: ninguna ola introduce una tabla sin introducir a la vez (a) quién la
escribe en producción, (b) qué pantalla la enseña, y (c) qué prueba falla si se queda
vacía.

---

## Ola 0 — El sujeto deja de ser opcional

**Duración estimada:** 1–2 semanas. **Bloquea:** todo lo demás.

### Problema

`subjectReference?: string` con `@IsOptional()`. Una integración que no lo manda produce
ejecuciones huérfanas: sin historial, sin desenlace posible, sin derecho de acceso
atendible. Y como el hash es de una vía, esas ejecuciones **no se pueden reparar
después**: no hay forma de reconstruir a quién pertenecían.

### Backend

1. **Política por ambiente y por artefacto, no interruptor global.** Añadir a
   `DecisionEnvironment` y a `DecisionArtifactVersion`:

   ```prisma
   enum SubjectReferencePolicy {
     REQUIRED        // rechaza la ejecución sin sujeto (400 SUBJECT_REFERENCE_REQUIRED)
     WARN            // ejecuta, marca la ejecución y cuenta en la métrica de cobertura
     NOT_APPLICABLE  // decisiones que legítimamente no tienen sujeto (p. ej. reglas de sistema)
   }
   ```

   Por defecto `WARN` en los ambientes existentes, `REQUIRED` en producción tras la
   ventana de migración. `NOT_APPLICABLE` exige justificación escrita en el artefacto,
   igual que hoy se exige base legal de tratamiento.

   _Por qué así y no obligatorio de golpe:_ poner `REQUIRED` global rompería a todo
   integrador vivo el día del despliegue. Una migración de contrato se hace midiendo
   primero cuánto falta, y para eso hace falta `WARN` con métrica.

2. **Registro de sujeto pseudónimo.** El HMAC actual permite agrupar pero no enumerar ni
   unir con cartera. Añadir:

   ```prisma
   model DecisionSubject {
     id                   BigInt   @id @default(autoincrement())
     tenantId             BigInt   @map("tenant_id")
     subjectReferenceHash String   @map("subject_reference_hash") @db.VarChar(128)
     firstSeenAt          DateTime @default(now()) @map("first_seen_at") @db.Timestamptz(6)
     lastSeenAt           DateTime @updatedAt @map("last_seen_at") @db.Timestamptz(6)
     decisionCount        Int      @default(0) @map("decision_count")
     @@unique([tenantId, subjectReferenceHash])
     @@map("decision_subject")
   }
   ```

   Sigue sin guardar el identificador en claro —el HMAC es la clave— pero da una entidad
   sobre la que colgar exposición, límites y comportamiento sin recorrer ejecuciones.

3. **Entidad de crédito.** Un desenlace pertenece a un préstamo, no a una ejecución: un
   préstamo genera muchas decisiones (originación, aumento, refinanciación, cobranza) y
   el análisis de cosecha necesita el préstamo, no cada una de ellas.

   ```prisma
   model CreditFacility {
     id                BigInt    @id @default(autoincrement())
     tenantId          BigInt    @map("tenant_id")
     subjectId         BigInt    @map("subject_id")
     externalReference String    @map("external_reference") @db.VarChar(160) // id en el core
     originationExecutionId BigInt? @map("origination_execution_id")
     principalAmount   Decimal   @map("principal_amount") @db.Decimal(18, 4)
     currencyCode      String    @map("currency_code") @db.VarChar(3)
     termMonths        Int       @map("term_months")
     annualRate        Decimal   @map("annual_rate") @db.Decimal(9, 6)
     disbursedAt       DateTime? @map("disbursed_at") @db.Timestamptz(6)
     closedAt          DateTime? @map("closed_at") @db.Timestamptz(6)
     @@unique([tenantId, externalReference])
     @@index([tenantId, subjectId])
     @@map("credit_facility")
   }
   ```

4. **`DecisionOutcomeObservation` gana `facilityId` opcional.** Compatible hacia atrás: la
   observación puede seguir colgando sólo de la ejecución (rechazos, que no tienen
   préstamo), y colgar además del préstamo cuando existe.

5. **Métrica y endpoint de cobertura:**
   `GET /v1/model-monitoring/coverage?from&to&environmentId` → `{ executions,
withSubject, subjectCoverageRatio, eligibleForOutcome, observed, outcomeCoverageRatio }`.
   Publicar `atlas_subject_coverage_ratio` y `atlas_outcome_coverage_ratio` en `/metrics`.

   _Ésta es la pieza que impide el modo de fallo silencioso:_ «cero filas» deja de ser
   indistinguible de «no hubo», porque hay un denominador.

### Frontend (portal)

- Ruta nueva `/decision-quality` (concentrador con pestañas, mismo patrón que `/workers`).
  Primera pestaña: **Cobertura**. Dos indicadores grandes con su denominador visible y la
  serie temporal, no un porcentaje solo — un 100 % sobre 3 ejecuciones no es una noticia.
- Registrar el patrón en `src/auth/route-access.ts` con una política nueva
  `accessPolicies.decisionQuality`. Sin esa línea la vista desaparece en silencio.
- En `ExecutionDetailPage` mostrar si la ejecución tiene sujeto, y **por qué no** si no lo
  tiene (política `WARN`, `NOT_APPLICABLE` con su justificación).
- Estilos en `src/styles/parts/decision-quality.css`, sólo tokens.

### Verificación

- Unitaria (motor): política `REQUIRED` rechaza con código estable; `WARN` ejecuta y
  marca; `NOT_APPLICABLE` exige justificación no vacía.
- Integración: la cobertura calcula bien con ejecuciones mezcladas de los tres tipos.
- E2E simulado: la pantalla enseña los dos ratios y sus denominadores.
- **E2E real** (`e2e/portal-real-calidad.spec.ts`, opt-in, uno por invocación): ejecuta una
  decisión con sujeto contra el motor real y la encuentra en la vista de cobertura.

### Hecho cuando

`subjectCoverageRatio` en producción ≥ 0,98 durante 14 días consecutivos y el ambiente de
producción está en `REQUIRED`.

---

## Ola 1 — Cerrar el lazo del desenlace

**Duración estimada:** 3–4 semanas. **Depende de:** Ola 0.

### Problema

La tabla existe; nadie la llena. Sin desenlace no hay recalibración, no hay medida de
política, y el champion/challenger que ya está montado (`DecisionDeploymentTraffic`,
`TrafficRulesEditor.tsx`) compara tráfico sin comparar resultados.

### Backend

1. **Módulo `outcome-ingestion`** con tres caminos, porque tres son los que existen en la
   realidad de una financiera:

   - **Lote conciliado** (el principal): `POST /v1/outcomes/batch` recibe un archivo o un
     cuerpo con filas `{ externalReference, windowDays, label, amount, source }`.
     Idempotente por `(facility, windowDays)` — ya lo garantiza el `@@unique`. Devuelve
     conteo aceptado, rechazado y **motivo por fila**, no un 200 mudo.
   - **Evento**: consumidor del bus para `LOAN_PAYMENT_OBSERVED` / `LOAN_WRITTEN_OFF`
     emitidos por el core, con `ProcessedEvent` para no reprocesar (el patrón ya existe).
   - **Manual**: alta puntual desde el portal, con `recordedBy` — el campo ya está — para
     fraude confirmado y correcciones.

2. **Planificador de ventanas.** `OutcomeWindowScheduler`: para cada préstamo, a los 30,
   60, 90, 180 y 360 días de la decisión, materializa una fila «pendiente de observar».
   Así el numerador y el denominador existen desde el principio, y una ventana que nadie
   observó **se ve** en vez de faltar.

   ```prisma
   model OutcomeWindowSchedule {
     id           BigInt    @id @default(autoincrement())
     tenantId     BigInt    @map("tenant_id")
     executionId  BigInt    @map("execution_id")
     facilityId   BigInt?   @map("facility_id")
     windowDays   Int       @map("window_days")
     dueAt        DateTime  @map("due_at") @db.Timestamptz(6)
     observedAt   DateTime? @map("observed_at") @db.Timestamptz(6)
     @@unique([executionId, windowDays])
     @@index([tenantId, dueAt, observedAt])
     @@map("outcome_window_schedule")
   }
   ```

3. **Inferencia de rechazo (`reject inference`), explícita y marcada.** El enum ya
   contempla `REJECTED_WOULD_HAVE_BEEN_GOOD`. Añadir a la observación:

   ```prisma
   inferenceMethod String? @map("inference_method") @db.VarChar(60) // null = observado
   ```

   Un desenlace inferido (por buró posterior, por aprobación en otra entidad) **nunca**
   se mezcla con uno observado en la misma métrica sin decirlo. Es la trampa clásica: el
   modelo se calibra sobre la población que ya aprobó y parece perfecto.

4. **Análisis de cosecha (`vintage`)**:
   `GET /v1/model-monitoring/vintage?artifactVersionId&windowDays&groupBy=month` →
   matriz cosecha × madurez con tasa de malos, volumen y monto. Es la vista que dice si
   la política de marzo fue peor que la de febrero, y es la razón de ser de todo esto.

5. **Tasas de transición (`roll rates`)** entre tramos de mora, por cosecha. Requiere
   observaciones múltiples por préstamo, que el `@@unique(executionId, windowDays)` ya
   admite.

### Frontend

- Pestaña **Desenlaces** en `/decision-quality`:
  - Cola de ventanas vencidas sin observar, ordenada por antigüedad, con el préstamo y la
    decisión enlazados.
  - Carga de lote con validación previa: enseña las filas que se rechazarían **antes** de
    aceptar nada, con el motivo de cada una.
  - Alta manual, con confirmación explícita y sello de quién.
- Pestaña **Cosechas**: la matriz cosecha × madurez, con la tasa de malos en escala
  secuencial. Usar la guía de `dataviz`; la escala secuencial es la correcta aquí, no una
  divergente — no hay punto medio neutro en «tasa de mora».
- En `ExecutionDetailPage`, bloque «Qué pasó después»: las observaciones de esa decisión
  con su ventana, su etiqueta y si fue observada o inferida.
- Ficha nueva de crédito: `/facilities/[facilityId]`, con la línea de tiempo de todas las
  decisiones tomadas sobre él. Registrar patrón en `route-access.ts`.

### Verificación

- Unitaria: idempotencia del lote (mismo archivo dos veces = mismo estado); rechazo de
  fila con `windowDays` inconsistente; el inferido no contamina la métrica del observado.
- Integración: el planificador materializa exactamente cinco ventanas por préstamo y no
  duplica al reejecutar.
- E2E simulado: subir un lote con dos filas malas enseña **las dos** antes de confirmar.
- **Gate permanente**: `outcomeCoverageRatio` a 90 días por debajo de un umbral
  configurable dispara alerta en `/metrics` y aviso persistente en el portal. Una tubería
  de datos que se calla cuando se rompe es peor que no tenerla.

### Hecho cuando

Hay al menos una cosecha completa de 90 días con cobertura ≥ 0,9 y la matriz se pinta con
datos reales.

---

## Ola 2 — Vigilancia continua, con línea base y alerta

**Duración estimada:** 2–3 semanas. **Depende de:** Ola 1.

### Problema

PSI, desempeño e impacto adverso ya se **calculan** (`monitoring-analytics.ts`), pero se
calculan cuando alguien hace un POST. No hay línea base contra la que comparar, no hay
periodicidad, no hay umbral, no hay aviso y no hay pantalla. Un cálculo bajo demanda que
nadie pide es un cálculo que no ocurre.

### Backend

1. **Línea base versionada.** Al promover una versión de artefacto a producción, congelar
   la distribución de sus variables de entrada como referencia:

   ```prisma
   model MonitoringBaseline {
     id                BigInt   @id @default(autoincrement())
     tenantId          BigInt   @map("tenant_id")
     artifactVersionId BigInt   @map("artifact_version_id")
     variableCode      String   @map("variable_code") @db.VarChar(120)
     bucketsJson       Json     @map("buckets_json")   // bordes + frecuencias
     sampleSize        Int      @map("sample_size")
     capturedAt        DateTime @default(now()) @map("captured_at") @db.Timestamptz(6)
     @@unique([artifactVersionId, variableCode])
     @@map("monitoring_baseline")
   }
   ```

   _Por qué al promover:_ la referencia tiene que ser la población con la que se validó el
   modelo. Tomarla «del mes pasado» hace que la deriva lenta nunca se detecte, porque la
   referencia deriva con ella.

2. **Evaluación programada** (`MonitoringEvaluatorService`, mismo patrón que
   `RetentionSweeperService`): diaria para PSI y volúmenes, semanal para desempeño e
   impacto adverso. Persistir cada evaluación con su veredicto:

   ```prisma
   enum MonitoringVerdict { OK WATCH BREACH }

   model MonitoringEvaluation {
     id                BigInt            @id @default(autoincrement())
     tenantId          BigInt            @map("tenant_id")
     artifactVersionId BigInt            @map("artifact_version_id")
     metricCode        String            @map("metric_code") @db.VarChar(60) // PSI, KS, AUC, AIR…
     scope             String            @db.VarChar(120)                    // variable o grupo
     value             Decimal           @db.Decimal(18, 8)
     threshold         Decimal           @db.Decimal(18, 8)
     verdict           MonitoringVerdict
     evaluatedAt       DateTime          @default(now()) @map("evaluated_at") @db.Timestamptz(6)
     @@index([tenantId, artifactVersionId, metricCode, evaluatedAt])
     @@map("monitoring_evaluation")
   }
   ```

   Umbrales de arranque, discutibles y configurables por tenant: PSI < 0,10 `OK`,
   0,10–0,25 `WATCH`, > 0,25 `BREACH`. Ratio de impacto adverso < 0,80 `BREACH` (regla de
   los cuatro quintos). KS y AUC con caída relativa > 10 % sobre la línea base `WATCH`.

3. **Discriminación**: añadir KS, AUC/Gini y curva de calibración a
   `monitoring-analytics.ts`. Ya está la mitad del trabajo (`summarizePerformance`).

4. **Comparación champion/challenger sobre desenlace real**, no sobre volumen:
   `GET /v1/model-monitoring/ab?deploymentId` → por rama de tráfico, tasa de aprobación,
   tasa de malos, pérdida esperada realizada e intervalo de confianza. Sin el intervalo,
   la comparación invita a decidir sobre ruido.

5. **Aviso**: cada `BREACH` emite `MONITORING_BREACH_DETECTED` al bus, que ya alimenta
   `Notification`. Reutilizar la tubería existente en lugar de inventar otra.

### Frontend

- Pestaña **Vigilancia** en `/decision-quality`: semáforo por versión desplegada, con la
  serie de cada métrica y el umbral dibujado como línea, no como color.
- Pestaña **Equidad**: los ratios de impacto adverso por atributo y grupo, con el aviso
  explícito de que el atributo se recogió **después** de decidir y nunca entró en la
  decisión — el propio esquema lo argumenta y la pantalla debe repetirlo, porque quien lo
  lee sin contexto verá «el motor guarda el género».
- Pestaña **A/B**: la comparación de ramas con su intervalo.
- Aviso persistente en la cabecera cuando hay un `BREACH` abierto sobre una versión en
  producción, con enlace a la métrica concreta.

### Verificación

- Unitaria: PSI contra vectores de referencia conocidos; el ratio de los cuatro quintos
  contra el ejemplo canónico; la curva de calibración sobre datos sintéticos.
- Integración: el evaluador programado escribe una fila por métrica y ámbito, y no
  duplica al correr dos veces el mismo día.
- E2E: un `BREACH` sembrado aparece en la cabecera y enlaza a su métrica.

### Hecho cuando

Hay 30 días de evaluaciones diarias sin hueco y al menos un `WATCH` que llegó a quien
correspondía.

---

## Ola 3 — Contexto en el momento correcto (`point-in-time`)

**Duración estimada:** 4–6 semanas. **Depende de:** Ola 0.

### Problema

Dos cosas distintas, ambas medidas:

- El runtime **no busca datos**: todo tiene que llegar en la petición. `expectedOrigin =
PROVIDER` y `DecisionVariableSource` son documentación que nadie ejecuta. Eso traslada
  al integrador la responsabilidad de reunir el contexto, y con ella la de equivocarse.
- `freshnessSlaSeconds` se declara y **no se impone**. Una variable con SLA de 60 s se
  acepta con un valor de hace tres días sin que nadie lo note.

Para microcrédito esto es grave por una razón concreta: la señal buena no es el buró, es
el comportamiento —extracto bancario, historial interno, uso previo—, y esa señal cambia
todos los días. Si no se sabe **de cuándo** era el dato, no se puede reentrenar sin fuga
de información ni defender la decisión dos años después.

### Backend

1. **Sello temporal por variable resuelta.** `DecisionExecutionVariable` gana:

   ```prisma
   observedAt   DateTime? @map("observed_at") @db.Timestamptz(6) // cuándo era cierto el valor
   fetchedAt    DateTime? @map("fetched_at") @db.Timestamptz(6)  // cuándo se obtuvo
   sourceVersion String?  @map("source_version") @db.VarChar(60) // versión del proveedor
   ageSeconds   Int?      @map("age_seconds")                    // derivado, para consultar barato
   ```

2. **Imposición de frescura** en la resolución, con política por dependencia
   (`DecisionArtifactVariableDependency.fallbackPolicy` ya existe y hoy no distingue este
   caso): `REJECT` (400 con código estable), `DEGRADE` (usa el valor y marca la ejecución
   como degradada, visible en la traza), `IGNORE` (sólo para variables no decisorias).
   Por defecto `DEGRADE` en la migración, `REJECT` como objetivo por variable crítica.

3. **Capa de resolución de proveedores (`feature-resolution`)**: un módulo que, dado el
   contrato de entrada de la versión desplegada, obtiene de proveedores registrados lo que
   no vino en la petición, respetando precedencia y autoridad (`precedence`,
   `isAuthoritative` ya están en `DecisionVariableSource`). Con caché por sujeto y ventana,
   circuito de corte por proveedor y presupuesto de latencia por ejecución.

   _Esto es lo más caro de todo el plan y lo más fácil de hacer mal._ Mitigación: se
   entrega primero **en modo sombra** —resuelve, registra lo que habría obtenido, y no
   afecta la decisión— durante al menos dos semanas, comparando contra lo que mandó el
   integrador. Sólo cuando la comparación es limpia se pasa a autoritativo, variable por
   variable, no de golpe.

4. **Consulta histórica reproducible**:
   `GET /v1/executions/{id}/context-snapshot` devuelve el contexto exacto con el que se
   decidió, con sellos y versiones de fuente. Es la respuesta a un regulador y a la vez
   el conjunto de entrenamiento correcto.

5. **Derivación de señal de los workers a variables de catálogo.** El worker de extracto
   bancario produce clasificación de movimientos; lo que el motor necesita son variables
   estables con contrato: `estimated_monthly_income`, `income_volatility_90d`,
   `days_negative_balance_90d`, `months_of_observed_history`. Se declaran en el catálogo
   con `expectedOrigin = DERIVED`, su versión y su SLA, y se calculan con
   `CalculatedField` —que ya existe, con versiones y pruebas—. El worker deja de ser una
   pantalla y pasa a ser una fuente.

### Frontend

- En `ExecutionDetailPage`, cada variable resuelta muestra su edad y su fuente, y las
  degradadas por frescura se marcan. Hoy la tabla dice el valor y calla de cuándo es.
- En el editor de variables (`VariableContractEditor.tsx`), configurar SLA y política de
  frescura, con el aviso de qué significa cada una.
- Vista de **salud de proveedores**: latencia, tasa de fallo, circuito abierto, y en modo
  sombra la tasa de discrepancia contra lo que manda el integrador.
- En `/workers`, enlace explícito desde cada worker a las variables derivadas que
  alimenta, para que la relación sea navegable en los dos sentidos.

### Verificación

- Unitaria: `REJECT` rechaza con código estable; `DEGRADE` marca y sigue; la precedencia
  entre dos fuentes se resuelve por `isAuthoritative` y luego por `precedence`.
- Integración: el modo sombra no altera ni una salida (comparación byte a byte contra la
  misma ejecución sin sombra).
- Contrato: `context-snapshot` de una ejecución vieja sigue devolviendo lo mismo tras
  cambiar la versión de la variable — es la prueba de que hay fotografía y no una lectura
  actual disfrazada.

### Hecho cuando

Todas las variables decisorias de al menos un artefacto en producción tienen SLA impuesto
y sello temporal, y el modo sombra de sus proveedores lleva dos semanas sin discrepancia
material.

---

## Ola 4 — La decisión se vuelve económica

**Duración estimada:** 4–5 semanas. **Depende de:** Olas 1 y 2 (sin desenlace no hay
calibración posible, y un PD sin calibrar es peor que ningún PD).

### Problema

La salida es categórica: `PASS/REVIEW/FAIL` más un límite calculado como `ingreso × 0,35`.
Eso es una regla, no una decisión. La decisión de microcrédito es _cuánto, a qué plazo, a
qué precio_, y esas tres se derivan de una probabilidad y unas pérdidas esperadas.

### Backend

1. **Salidas de riesgo de primera clase** en `DecisionOutputContractField`, con tipo
   semántico nuevo además del tipo de dato: `PROBABILITY_OF_DEFAULT`,
   `LOSS_GIVEN_DEFAULT`, `EXPOSURE_AT_DEFAULT`, `EXPECTED_LOSS`, `RISK_GRADE`,
   `PRICED_RATE`, `APPROVED_LIMIT`, `APPROVED_TERM`.

   Que sea un tipo semántico y no una convención de nombre importa: permite que el motor
   valide rangos (una PD fuera de [0,1] es un defecto, no un valor), que la calibración
   sepa qué columna mirar, y que la pantalla lo pinte como probabilidad.

2. **Registro de calibración.** Por versión de artefacto y cosecha: PD predicha media vs.
   tasa de malos observada, por decil. Con test de Hosmer-Lemeshow o equivalente, y el
   veredicto persistido como una `MonitoringEvaluation` más — reutilizando la Ola 2 en vez
   de duplicar tubería.

3. **Bandas de riesgo y matriz de política.** Una tabla versionada y aprobable que traduce
   `RISK_GRADE` × capacidad de pago a límite, plazo y precio. Vive como artefacto, con su
   aprobación y su despliegue, no como constantes en un script.

4. **Simulación económica del cambio de política.** Extender el simulador: dado un cambio
   de matriz, y con las cosechas observadas, estimar el efecto en tasa de aprobación,
   pérdida esperada, ingreso por interés y margen. Con el aviso de que es una estimación
   sobre la población aprobada, que es donde la mayoría de estas herramientas mienten.

5. **Frontera de decisión y punto de corte.** `GET /v1/model-monitoring/cutoff-analysis`:
   para cada corte posible, tasa de aprobación, tasa de malos y margen. Es la conversación
   que el negocio quiere tener y hoy no puede.

### Frontend

- Panel de contrato de salida (`OutputContractPanel.tsx`) admite el tipo semántico y avisa
  si un artefacto de originación no declara PD.
- Vista **Calibración**: gráfico de calibración por decil, predicho vs. observado, con
  banda de confianza.
- Vista **Punto de corte**: la curva aprobación/pérdida con el corte actual marcado y el
  efecto de moverlo. Interactiva, pero **no** ejecuta nada: propone un cambio de artefacto
  que sigue el circuito de aprobación normal. Un control que cambia política de crédito
  sin pasar por gobierno es exactamente lo que este motor existe para evitar.
- Editor de la matriz de política, con vista previa del reparto de la cartera actual entre
  bandas.

### Verificación

- Unitaria: PD fuera de rango rechaza al compilar; la calibración sobre datos sintéticos
  con desviación conocida la detecta.
- E2E: mover el corte en la pantalla produce una propuesta de cambio, no un despliegue.

### Hecho cuando

Un artefacto de originación en producción publica PD, pérdida esperada y grado, y hay al
menos una cosecha con curva de calibración medida.

---

## Ola 5 — El ciclo de vida completo, no sólo la originación

**Duración estimada:** 4–6 semanas. **Depende de:** Olas 0, 1 y 3.

### Problema

El motor modela el instante de originación. En un negocio de microcrédito sostenido, la
mayoría de las decisiones —y casi todo el margen— están después: renovar, subir el cupo,
refinanciar, a quién cobrar primero, a quién no molestar. Hay un grafo de cobranza como
**demo**; no hay un concepto de tipo de decisión que las relacione.

### Backend

1. **Tipo de decisión de primera clase** en `DecisionArtifact`:

   ```prisma
   enum DecisionKind {
     ORIGINATION
     LIMIT_MANAGEMENT   // aumento o reducción de línea
     RENEWAL
     RESTRUCTURE
     COLLECTIONS
     EARLY_WARNING
     FRAUD_SCREENING
   }
   ```

   No es una etiqueta decorativa: determina qué contexto es obligatorio (una decisión de
   cobranza sin comportamiento de pago es un error de diseño, no una decisión pobre), qué
   ventanas de desenlace aplican y contra qué línea base se mide.

2. **Contexto de comportamiento** como variables derivadas del propio motor: número de
   créditos previos, peor mora histórica, mora actual, cumplimiento de pago, antigüedad
   como cliente, utilización de línea. Se calculan sobre `CreditFacility` y las
   observaciones de la Ola 1 — es decir, el motor se alimenta de su propia historia, que
   es el activo que hoy tira a la basura.

3. **Exposición y apetito de cartera.** El estado del negocio como entrada explícita:

   ```prisma
   model PortfolioState {
     id                BigInt   @id @default(autoincrement())
     tenantId          BigInt   @map("tenant_id")
     asOf              DateTime @map("as_of") @db.Timestamptz(6)
     metricCode        String   @map("metric_code") @db.VarChar(60) // TOTAL_EXPOSURE, PAR30, ORIGINATION_BUDGET…
     segment           String?  @db.VarChar(120)
     value             Decimal  @db.Decimal(18, 4)
     @@unique([tenantId, asOf, metricCode, segment])
     @@map("portfolio_state")
   }
   ```

   Y límites duros comprobados en ejecución: exposición máxima por sujeto, concentración
   por segmento, presupuesto de originación del periodo. Un límite de concentración que
   sólo vive en una regla de un grafo se olvida al clonar el grafo; como restricción del
   motor, no.

4. **Detección de fraude con estado compartido**: velocidad de solicitudes por sujeto y
   por dispositivo, reutilización de datos entre sujetos distintos, y detección de anillos
   sobre el grafo de coincidencias. Sólo es posible con la Ola 0 hecha.

### Frontend

- `/facilities/[facilityId]`: la línea de tiempo completa del crédito con cada decisión, su
  tipo, su desenlace y el contexto de cuándo se tomó.
- Vista de sujeto (pseudónima): sus créditos, su exposición, su comportamiento. Con control
  de acceso propio y registro de acceso —`DecisionAccessAudit` ya existe— porque es la
  pantalla más sensible del portal.
- Panel de **apetito de cartera**: exposición contra límite, consumo del presupuesto,
  concentración por segmento. Sirve para explicar por qué una solicitud buena se rechazó
  un 28 de mes.
- El grafo de cobranza pasa de semilla de demostración a plantilla de producto, con su
  documentación.

### Verificación

- Unitaria: el límite de exposición rechaza la ejecución que lo superaría, con código y
  motivo legibles.
- Integración: las variables de comportamiento de un sujeto con tres créditos previos
  coinciden con lo calculado a mano en la fixture.
- **E2E real**: originar → observar desenlace → solicitar aumento de línea → la decisión
  de aumento ve el comportamiento de la primera. Es la prueba que demuestra que el circuito
  está cerrado de verdad.

### Hecho cuando

Hay al menos dos tipos de decisión distintos en producción sobre los mismos sujetos, y la
segunda lee la historia que produjo la primera.

---

## Ola 6 — Que siga siendo legal y gobernable dentro de cinco años

**Duración estimada:** 2–3 semanas. **Transversal**, puede solaparse.

### Backend

1. **Vigencia del consentimiento.** `ProcessingLegalBasis` ya existe por versión de
   artefacto. Falta la vigencia **por sujeto y por finalidad**: leer el extracto bancario
   de alguien tiene una base legal con fecha de caducidad, y decidir con un dato cuyo
   permiso venció es una infracción aunque el dato siga en la caché.

   ```prisma
   model SubjectConsent {
     id         BigInt    @id @default(autoincrement())
     tenantId   BigInt    @map("tenant_id")
     subjectId  BigInt    @map("subject_id")
     purpose    String    @db.VarChar(120)
     basis      ProcessingLegalBasis
     grantedAt  DateTime  @map("granted_at") @db.Timestamptz(6)
     expiresAt  DateTime? @map("expires_at") @db.Timestamptz(6)
     revokedAt  DateTime? @map("revoked_at") @db.Timestamptz(6)
     evidenceRef String?  @map("evidence_ref") @db.VarChar(200)
     @@index([tenantId, subjectId, purpose])
     @@map("subject_consent")
   }
   ```

   Comprobado en ejecución para las variables cuya `decisionUseRestriction` lo exija.

2. **Reidentificación controlada.** El HMAC protege bien y estorba para operar: atender un
   reclamo exige poder ir del caso a la persona. Un servicio con doble autorización,
   propósito declarado y registro en `DecisionAccessAudit`, nunca una consulta libre.

3. **Retención diferenciada.** El barrido existe; falta que distinga: la traza de ejecución
   caduca antes que la evidencia regulatoria, y el desenlace tiene que sobrevivir a la
   traza porque el análisis de cosecha lo necesita a 360 días. Retención por tipo de dato,
   configurable, y con reporte de qué se borró.

4. **Gobierno del modelo (SR 11-7 / CMN 4.557).** El expediente por versión: quién la
   desarrolló, quién la validó de forma independiente, qué datos usó, qué limitaciones
   declaró, cuándo toca revalidar. Casi todo el material ya está disperso en
   `DecisionApprovalEvidence`, `BusinessObjective` y `PolicyRequirement`; falta reunirlo y
   ponerle vencimiento.

### Frontend

- **Expediente del modelo**: una pantalla por versión desplegada que reúne el linaje, las
  validaciones, las métricas vigentes y la fecha de revalidación, exportable. Es el
  documento que se entrega en una supervisión.
- Gestión de solicitudes de titular: las que hoy sólo tienen endpoint
  (`v1/data-subject-requests`). Alta, seguimiento, resolución y constancia.
- Vista de consentimientos por sujeto, con lo que caduca pronto.

---

## 7. Los gates que impiden la reincidencia

Esta sección es la que responde a «asegúrate de que quede resuelto». Sin ella, dentro de
un año habrá tres capacidades nuevas que nadie usa, exactamente como hoy.

1. **Gate de superficie: ningún endpoint invisible.**
   Script nuevo en el portal, `scripts/verify-engine-surface.mjs`, dentro de `yarn verify`:
   lee `openapi/openapi.json` del motor y exige que **cada** operación esté (a) consumida
   por el portal, (b) declarada en `docs/superficie-no-consumida.md` con motivo y
   responsable, o (c) marcada en el propio OpenAPI como interna. Un endpoint nuevo sin
   pantalla ni excusa pone la CI en rojo.
   _Este gate, existiendo hace seis meses, habría evitado todo este documento._

2. **Gate de cobertura del circuito.** `subjectCoverageRatio` y `outcomeCoverageRatio` como
   SLO con umbral. Por debajo: alerta y aviso en el portal. Se mide el circuito, no el
   código.

3. **Gate de frescura de vigilancia.** Si la última `MonitoringEvaluation` de una versión
   en producción tiene más de 48 h, es un `BREACH` por sí solo. Una vigilancia que se
   detuvo y no avisa es peor que ninguna.

4. **Gate de contrato económico.** Un artefacto de tipo `ORIGINATION` que no declara PD ni
   pérdida esperada no compila para producción. Se puede eximir, por escrito, en el
   artefacto.

5. **E2E reales por ola** (`e2e/portal-real-*.spec.ts`), respetando la regla del
   repositorio: **uno por invocación**, porque el limitador del motor (300/min) hace que
   encadenados devuelvan 429 y las pruebas se salten en verde.

6. **Revalidación con vencimiento.** El expediente del modelo caduca. Vencido, la versión
   aparece marcada en despliegues y en el expediente. No bloquea la ejecución —cortar el
   crédito de una financiera por un papel vencido es peor que el papel vencido— pero no se
   puede ignorar en silencio.

---

## 8. Secuencia y dependencias

```
Ola 0 (sujeto)  ──┬──> Ola 1 (desenlace) ──> Ola 2 (vigilancia) ──> Ola 4 (economía)
                  │            │
                  ├──> Ola 3 (point-in-time) ────────────────────┐
                  │                                              │
                  └──────────────────────> Ola 5 (ciclo de vida) ┘

Ola 6 (legal/gobierno) y Ola 7 (gates): transversales, se solapan desde el principio.
```

Orden de mérito si hay que recortar:

1. **Ola 0 + Ola 1.** Sin ellas nada de lo demás existe, y son las más baratas ahora y las
   más caras después: cambian el esquema de todo lo ya persistido, y lo ya persistido sin
   sujeto **no se puede reparar** porque el HMAC no tiene vuelta.
2. **Ola 7 (gate 1).** Un día de trabajo. Evita que el resto se atrofie.
3. **Ola 2.** Barata: el cálculo ya está hecho, falta programarlo y enseñarlo.
4. **Ola 4** antes que la **5** si el negocio es de volumen; la **5** antes que la **4** si
   es de recurrencia. En microcrédito casi siempre es de recurrencia.
5. **Ola 3** es la más cara y la única con riesgo de romper lo que funciona. Modo sombra
   obligatorio.

Estimación total: 20–29 semanas de un equipo pequeño, con las olas 0, 1, 2 y el gate 1
—que es el 70 % del valor— en las primeras 7–9.

---

## 9. Riesgos, y qué se hace con cada uno

| Riesgo                                                            | Mitigación                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Hacer el sujeto obligatorio rompe integraciones vivas             | Política por ambiente, `WARN` con métrica primero, `REQUIRED` cuando la cobertura ya es alta    |
| El core no entrega desenlaces con la calidad necesaria            | Tres caminos de ingesta y validación por fila con motivo; la carencia se **mide**, no se supone |
| La resolución de proveedores mete latencia o cae                  | Modo sombra dos semanas, circuito de corte, presupuesto de latencia, `DEGRADE` antes que caída  |
| PD mal calibrada usada para precio produce daño real y silencioso | Gate de calibración; sin cosecha observada la PD no puede alimentar precio, sólo orden          |
| Recoger atributos para medir sesgo se lee como discriminar        | Ya está bien diseñado en el esquema; la pantalla debe **explicarlo**, no sólo mostrarlo         |
| El plan se hace y nadie lo usa                                    | Ola 7. Es la única defensa estructural, y por eso no es opcional                                |
| Reidentificación se convierte en una consulta de rutina           | Doble autorización, propósito declarado, registro y revisión periódica de los accesos           |

---

## 10. Definición de terminado

El motor está listo para microcrédito de largo plazo cuando puede responder, con datos y
sin trabajo manual, estas siete preguntas:

1. ¿A quién le decidí esto, y qué más le he decidido antes?
2. ¿Acerté? ¿A 30, 90, 180 y 360 días?
3. ¿La política de este mes es mejor que la del mes pasado, y cuánto?
4. ¿Con qué datos exactos decidí, de cuándo eran, y quién los dio?
5. ¿Cuánto espero perder con lo que aprobé hoy, y a qué precio lo cobré?
6. ¿Estoy tratando distinto a grupos que no debería, y desde cuándo?
7. ¿Qué hago con este cliente ahora que ya lleva ocho meses conmigo?

Hoy responde bien la 4 a medias, y ninguna de las otras seis.
