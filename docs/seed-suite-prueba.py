#!/usr/bin/env python3
"""
Crea una SUITE DE PRUEBA de ejemplo (con un caso) para una versión de artefacto y
la ejecuta, para que veas cómo se trabaja y cómo funciona el gate de calidad.

Contrato real (testing.controller.ts):
  POST /v1/artifact-versions/:versionId/test-suites   (crear suite + casos)
  POST /v1/test-suites/:suiteId/runs                  (encolar ejecución)

Requisitos: MANAGEMENT_API_KEY con rol QA_ANALYST/RISK_ANALYST/FRAUD_ANALYST.
La versión debe estar COMPILADA para poder ejecutar la suite (si no, verás
"No compiled artifact available": primero valida/compila la versión).

Uso (PowerShell):
    $env:MANAGEMENT_API_KEY = "<tu-key>"
    $env:VERSION_ID = "<id-version-artefacto>"
    python docs/seed-suite-prueba.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("DECISION_ENGINE_URL", "http://127.0.0.1:3000").rstrip("/")
API_KEY = os.environ.get("MANAGEMENT_API_KEY", "")
TENANT = os.environ.get("TENANT_ID", "1")
VERSION_ID = os.environ.get("VERSION_ID", "<id-version>")

# Ajusta `input` y `expectedResult` a las variables reales de TU artefacto.
SUITE = {
    "suiteCode": "SUITE_DEMO_CREDITO",
    "name": "Regresión de decisión de crédito (demo)",
    "suiteType": "REGRESSION",
    "isBlocking": True,
    "cases": [
        {
            "caseCode": "CASO_APROBADO",
            "testName": "Ingreso alto y sin deuda → aprobado",
            "input": {"monthly_income": 4000, "has_active_debt": False},
            "expectedResult": {"decision_outcome": "APPROVED"},
            "isActive": True,
        },
        {
            "caseCode": "CASO_REVISION",
            "testName": "Ingreso medio → revisión",
            "input": {"monthly_income": 1800, "has_active_debt": True},
            "expectedResult": {"decision_outcome": "MANUAL_REVIEW"},
            "isActive": True,
        },
    ],
}


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


def main():
    if not API_KEY or "<" in VERSION_ID:
        print("✗ Define MANAGEMENT_API_KEY y VERSION_ID.")
        sys.exit(2)

    print(f"→ Creando suite en la versión {VERSION_ID} ...")
    status, suite = call("POST", f"/v1/artifact-versions/{VERSION_ID}/test-suites", SUITE)
    print(f"  POST test-suites -> {status}")
    if status not in (200, 201):
        print(json.dumps(suite, indent=2, ensure_ascii=False)[:900])
        sys.exit(1)
    suite_id = (suite or {}).get("id")
    print(f"  ✓ Suite creada (id={suite_id}) con {len(SUITE['cases'])} casos.")

    if suite_id:
        st2, run = call("POST", f"/v1/test-suites/{suite_id}/runs", {"triggerType": "MANUAL_UI"})
        print(f"  POST runs -> {st2}")
        if st2 in (200, 201):
            print(f"  ✓ Ejecución encolada (run id={(run or {}).get('id')}). Míralas en Suites de Prueba.")
        elif (run or {}).get("code") == "COMPILED_ARTIFACT_NOT_FOUND":
            print("  ⚠ La versión no está compilada: valida/compila primero y reintenta el run.")
        else:
            print(json.dumps(run, indent=2, ensure_ascii=False)[:700])

    print("\n✅ Listo. Abre «Suites de Prueba», carga esta versión y verás la suite y su resultado.")


if __name__ == "__main__":
    main()
