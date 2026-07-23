#!/usr/bin/env python3
"""
Seeder de algoritmos de decisión LÓGICOS (no absurdos).

Crea en la plataforma las variables, reason codes y artefactos de los cuatro
algoritmos documentados en `seed-algorithms.md` (scoring de crédito, triage de
fraude, elegibilidad KYC y asignación de límite). Después abre cada artefacto en
el Editor de Grafo y arma el flujo siguiendo el blueprint del .md.

Solo usa la librería estándar. Es idempotente: si un registro ya existe (409) lo
omite, así que puedes correrlo varias veces sin duplicar.

Uso (PowerShell):
    $env:MANAGEMENT_API_KEY = "<tu-management-api-key>"
    python docs/seed_algorithms.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("DECISION_ENGINE_URL", "http://127.0.0.1:3000").rstrip("/")
API_KEY = os.environ.get("MANAGEMENT_API_KEY", "")
TENANT = os.environ.get("TENANT_ID", "1")

# Variables compartidas por los algoritmos (dedup por código). type = tipo lógico.
VARIABLES = [
    ("edad", "Edad", "INTEGER", "Edad del solicitante en años"),
    ("ingreso_mensual", "Ingreso mensual", "NUMBER", "Ingreso neto mensual"),
    ("deuda_mensual", "Deuda mensual", "NUMBER", "Cuotas de deuda mensuales"),
    ("antiguedad_laboral_meses", "Antigüedad laboral", "INTEGER", "Meses en el empleo actual"),
    ("score_buro", "Score de buró", "INTEGER", "Score de buró de crédito (300-850)"),
    ("monto", "Monto", "NUMBER", "Importe de la transacción"),
    ("transacciones_ultima_hora", "Transacciones última hora", "INTEGER", "Velocidad transaccional"),
    ("pais_emisor", "País emisor", "STRING", "País de emisión de la tarjeta"),
    ("pais_transaccion", "País transacción", "STRING", "País donde ocurre la transacción"),
    ("dispositivo_conocido", "Dispositivo conocido", "BOOLEAN", "Dispositivo ya visto antes"),
    ("documento_valido", "Documento válido", "BOOLEAN", "Identidad verificada"),
    ("en_lista_sanciones", "En lista de sanciones", "BOOLEAN", "Coincidencia en listas de sanciones"),
    ("consentimiento", "Consentimiento", "BOOLEAN", "Consentimiento de datos otorgado"),
]

REASON_CODES = [
    ("AGE_NOT_ELIGIBLE", "No cumple la edad mínima."),
    ("DTI_TOO_HIGH", "La carga de deuda sobre ingreso es demasiado alta."),
    ("LOW_BUREAU_SCORE", "El score de buró está por debajo del umbral."),
    ("APPROVED_POLICY", "Cumple la política de aprobación."),
    ("MANUAL_REVIEW_REQUIRED", "Requiere revisión manual."),
    ("VELOCITY_HIGH", "Velocidad transaccional inusualmente alta."),
    ("GEO_MISMATCH", "País de tarjeta y de transacción no coinciden."),
    ("UNKNOWN_DEVICE", "Dispositivo no reconocido en operación de monto alto."),
    ("FRAUD_CLEAR", "Sin señales de fraude relevantes."),
    ("SANCTIONS_HIT", "Coincidencia en listas de sanciones."),
    ("INVALID_DOCUMENT", "Documento de identidad no válido."),
    ("NO_CONSENT", "Falta el consentimiento de datos."),
    ("KYC_APPROVED", "KYC aprobado."),
    ("LIMIT_PREMIUM", "Elegible para límite premium."),
    ("LIMIT_STANDARD", "Elegible para límite estándar."),
    ("LIMIT_BASIC", "Elegible para límite básico."),
]

# (código, nombre, dominio-preferido, propósito)
ARTIFACTS = [
    ("SCORING_CREDITO_CONSUMO", "Scoring de crédito de consumo", "CREDIT",
     "Aprobar, derivar o rechazar una solicitud de crédito de consumo y asignar línea."),
    ("TRIAGE_FRAUDE_TRANSACCION", "Triage de fraude transaccional", "FRAUD",
     "Dejar pasar una transacción o derivarla a revisión por señales de riesgo."),
    ("ELEGIBILIDAD_ONBOARDING_KYC", "Elegibilidad de onboarding KYC", "COMPLIANCE",
     "Decidir si un cliente nuevo puede completar el alta."),
    ("ASIGNACION_LIMITE_TARJETA", "Asignación de límite de tarjeta", "CREDIT",
     "Asignar límite y tier de tarjeta según capacidad y riesgo."),
]


def call(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("content-type", "application/json")
    req.add_header("x-api-key", API_KEY)
    req.add_header("x-tenant-id", TENANT)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read().decode("utf-8") or "null")
        except json.JSONDecodeError:
            return err.code, None
    except urllib.error.URLError as err:
        print(f"✗ No se pudo conectar a {BASE}: {err.reason}")
        sys.exit(2)


def option(group, *prefer):
    """Elige un valor válido del catálogo /v1/views/options para no adivinar enums."""
    status, body = call("GET", f"/v1/views/options?group={group}")
    values = [str(item.get("value")) for item in (body or []) if isinstance(item, dict)]
    for wanted in prefer:
        for value in values:
            if wanted.upper() in value.upper():
                return value
    return values[0] if values else (prefer[0] if prefer else "")


def create(label, path, body, code):
    status, _ = call("POST", path, body)
    if status in (200, 201):
        print(f"  ✓ {label}: {code}")
    elif status == 409:
        print(f"  = {label} ya existía: {code}")
    else:
        print(f"  ✗ {label} {code} -> {status}")


def main():
    if not API_KEY:
        print("✗ Falta MANAGEMENT_API_KEY.")
        sys.exit(2)

    classification = option("dataClassification", "INTERNAL", "CONFIDENTIAL")
    owner = option("ownerTeam", "DECISION", "RISK")
    art_type = option("artifactType", "DECISION", "RULESET", "SCORECARD")
    severity = option("reasonSeverity", "MEDIUM", "INFO")
    category = option("reasonCategory", "CREDIT", "POLICY")
    types = {t: option("variableDataType", t) for t in {"INTEGER", "NUMBER", "STRING", "BOOLEAN"}}
    domains = {d: option("riskDomain", d) for d in {"CREDIT", "FRAUD", "COMPLIANCE"}}

    print(f"→ Sembrando algoritmos lógicos en {BASE}")
    print("Variables:")
    for code, name, dtype, desc in VARIABLES:
        create("variable", "/v1/variables", {
            "variableCode": code,
            "canonicalName": name,
            "businessDescription": desc,
            "dataClassification": classification,
            "ownerTeam": owner,
            "isSensitive": False,
            "initialVersion": {
                "dataType": types.get(dtype, dtype),
                "nullable": False,
                "sources": [],
                "validationRules": [],
            },
        }, code)

    print("Reason codes:")
    for code, message in REASON_CODES:
        create("reason code", "/v1/reason-codes", {
            "reasonCode": code,
            "category": category,
            "publicMessage": message,
            "internalMessage": message,
            "severity": severity,
            "isAdverseAction": code.startswith(("DECLINE", "AGE", "DTI", "LOW", "SANCTIONS")),
        }, code)

    print("Artefactos:")
    for code, name, domain, purpose in ARTIFACTS:
        create("artefacto", "/v1/artifacts", {
            "artifactCode": code,
            "name": name,
            "artifactType": art_type,
            "ownerTeam": owner,
            "businessPurpose": purpose,
            "riskDomain": domains.get(domain, domain),
            "semanticVersion": "1.0.0",
        }, code)

    print("\n✅ Listo. Abre cada artefacto en el Editor de Grafo y arma el flujo")
    print("   siguiendo docs/seed-algorithms.md.")


if __name__ == "__main__":
    main()
