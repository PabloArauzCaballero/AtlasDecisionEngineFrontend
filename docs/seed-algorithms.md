# Algoritmos de decisión de ejemplo (seeders lógicos)

Cuatro algoritmos **realistas de decisión financiera** para poblar la plataforma
y practicar. No son ejemplos absurdos: cada uno refleja una decisión de crédito,
fraude o cumplimiento como las que toma un analista.

Cómo usarlos:

1. Ejecuta [`seed_algorithms.py`](seed_algorithms.py) para crear en la plataforma
   las **variables**, **reason codes** y **artefactos** de cada algoritmo.
2. Abre cada artefacto en el **Editor de Grafo** y construye el flujo siguiendo el
   blueprint de abajo (nodos Condición/Score/Resultado y sus conexiones). La
   "Revisión de flujo" te confirmará en vivo que las entradas y salidas cuadran.

Convención de los blueprints: cada regla se lee de arriba a abajo; la primera que
se cumple decide (fail-closed).

---

## 1. `SCORING_CREDITO_CONSUMO` — Scoring de crédito de consumo

**Dominio:** CREDIT · **Propósito:** aprobar, derivar o rechazar una solicitud de
crédito de consumo y asignar una línea.

**Entradas**

| Código                     | Tipo    | Significado                        |
| -------------------------- | ------- | ---------------------------------- |
| `edad`                     | INTEGER | Edad del solicitante en años       |
| `ingreso_mensual`          | NUMBER  | Ingreso neto mensual               |
| `deuda_mensual`            | NUMBER  | Cuotas de deuda mensuales actuales |
| `antiguedad_laboral_meses` | INTEGER | Meses en el empleo actual          |
| `score_buro`               | INTEGER | Score de buró (300–850)            |

**Salidas:** `outcome` (STRING), `risk_band` (STRING), `credit_limit` (NUMBER)

**Lógica**

1. `edad < 18` → **DECLINED** · reason `AGE_NOT_ELIGIBLE`
2. `deuda_mensual / ingreso_mensual > 0.45` → **DECLINED** · reason `DTI_TOO_HIGH`
3. `score_buro < 550` → **DECLINED** · reason `LOW_BUREAU_SCORE`
4. `score_buro >= 700` **y** `antiguedad_laboral_meses >= 12` → **APPROVED**,
   `risk_band = LOW`, `credit_limit = min(5000, ingreso_mensual * 0.35)` ·
   reason `APPROVED_POLICY`
5. En otro caso → **MANUAL_REVIEW**, `risk_band = MEDIUM` · reason
   `MANUAL_REVIEW_REQUIRED`

---

## 2. `TRIAGE_FRAUDE_TRANSACCION` — Triage de fraude transaccional

**Dominio:** FRAUD · **Propósito:** dejar pasar una transacción o derivarla a
revisión por señales de riesgo.

**Entradas**

| Código                      | Tipo    | Significado                           |
| --------------------------- | ------- | ------------------------------------- |
| `monto`                     | NUMBER  | Importe de la transacción             |
| `transacciones_ultima_hora` | INTEGER | Nº de transacciones en la última hora |
| `pais_emisor`               | STRING  | País de emisión de la tarjeta         |
| `pais_transaccion`          | STRING  | País donde ocurre la transacción      |
| `dispositivo_conocido`      | BOOLEAN | Si el dispositivo ya se había visto   |

**Salidas:** `outcome` (STRING)

**Lógica**

1. `transacciones_ultima_hora > 10` → **REVIEW** · reason `VELOCITY_HIGH`
2. `pais_emisor != pais_transaccion` **y** `monto > 1000` → **REVIEW** · reason
   `GEO_MISMATCH`
3. `dispositivo_conocido == false` **y** `monto > 500` → **REVIEW** · reason
   `UNKNOWN_DEVICE`
4. En otro caso → **PASS** · reason `FRAUD_CLEAR`

---

## 3. `ELEGIBILIDAD_ONBOARDING_KYC` — Elegibilidad de onboarding (KYC)

**Dominio:** COMPLIANCE · **Propósito:** decidir si un cliente nuevo puede
completar el alta.

**Entradas**

| Código               | Tipo    | Significado                         |
| -------------------- | ------- | ----------------------------------- |
| `edad`               | INTEGER | Edad del solicitante                |
| `documento_valido`   | BOOLEAN | Documento de identidad verificado   |
| `en_lista_sanciones` | BOOLEAN | Coincidencia en listas de sanciones |
| `consentimiento`     | BOOLEAN | Consentimiento de datos otorgado    |

**Salidas:** `outcome` (STRING)

**Lógica**

1. `en_lista_sanciones == true` → **REJECTED** · reason `SANCTIONS_HIT`
2. `documento_valido == false` → **REJECTED** · reason `INVALID_DOCUMENT`
3. `edad < 18` → **REJECTED** · reason `AGE_NOT_ELIGIBLE`
4. `consentimiento == false` → **REJECTED** · reason `NO_CONSENT`
5. En otro caso → **ELIGIBLE** · reason `KYC_APPROVED`

---

## 4. `ASIGNACION_LIMITE_TARJETA` — Asignación de límite de tarjeta

**Dominio:** CREDIT · **Propósito:** asignar un límite y un tier de tarjeta según
capacidad y riesgo.

**Entradas**

| Código            | Tipo    | Significado             |
| ----------------- | ------- | ----------------------- |
| `ingreso_mensual` | NUMBER  | Ingreso neto mensual    |
| `score_buro`      | INTEGER | Score de buró (300–850) |

**Salidas:** `credit_limit` (NUMBER), `tier` (STRING)

**Lógica**

1. `score_buro >= 750` → `tier = PREMIUM`, `credit_limit = ingreso_mensual * 3` ·
   reason `LIMIT_PREMIUM`
2. `score_buro >= 650` → `tier = STANDARD`, `credit_limit = ingreso_mensual * 1.5`
   · reason `LIMIT_STANDARD`
3. En otro caso → `tier = BASIC`, `credit_limit = ingreso_mensual * 0.5` · reason
   `LIMIT_BASIC`

---

### Reason codes usados

`AGE_NOT_ELIGIBLE`, `DTI_TOO_HIGH`, `LOW_BUREAU_SCORE`, `APPROVED_POLICY`,
`MANUAL_REVIEW_REQUIRED`, `VELOCITY_HIGH`, `GEO_MISMATCH`, `UNKNOWN_DEVICE`,
`FRAUD_CLEAR`, `SANCTIONS_HIT`, `INVALID_DOCUMENT`, `NO_CONSENT`, `KYC_APPROVED`,
`LIMIT_PREMIUM`, `LIMIT_STANDARD`, `LIMIT_BASIC`.
