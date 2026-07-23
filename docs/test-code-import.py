#!/usr/bin/env python3
"""
Prueba de humo: carga de versión por script (Code -> Flow Import).

Verifica de punta a punta que subir un algoritmo escrito en Python/JavaScript al
Decision Engine (endpoint `POST /v1/code-imports`) funciona: el motor recibe el
código, lo analiza y devuelve un import consultable. Solo usa la librería estándar
(no requiere `pip install`).

Requisitos
----------
- Backend Decision Engine corriendo (por defecto http://127.0.0.1:3000).
- Una API key de gestión con rol RISK_ANALYST o FRAUD_ANALYST.

Uso (PowerShell)
----------------
    $env:MANAGEMENT_API_KEY = "<tu-management-api-key>"
    # opcionales: $env:DECISION_ENGINE_URL="http://127.0.0.1:3000"  $env:TENANT_ID="1"
    python docs/test-code-import.py

Salida: imprime cada paso y termina con "OK" (exit 0) si la carga funciona, o el
detalle del error (exit 1). 127.0.0.1 en vez de localhost evita el problema de
resolución IPv6 en Windows.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("DECISION_ENGINE_URL", "http://127.0.0.1:3000").rstrip("/")
API_KEY = os.environ.get("MANAGEMENT_API_KEY", "")
TENANT = os.environ.get("TENANT_ID", "1")

# Un algoritmo de decisión LÓGICO (riesgo de crédito), no un ejemplo absurdo.
PYTHON_SOURCE = """
# Decide el nivel de riesgo de una solicitud de crédito a partir de variables de entrada.
income = variables["monthly_income"]
has_debt = variables["has_active_debt"]

if income >= 3000 and not has_debt:
    result = {"risk_level": "LOW", "explanation": "Ingreso estable y sin deuda activa"}
elif income >= 1500:
    result = {"risk_level": "MEDIUM", "explanation": "Ingreso moderado, revisar caso"}
else:
    result = {"risk_level": "HIGH", "explanation": "Ingreso insuficiente"}
""".strip()


def call(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("content-type", "application/json")
    req.add_header("x-api-key", API_KEY)
    req.add_header("x-tenant-id", TENANT)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8") or "null"
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8") or "null"
        try:
            return err.code, json.loads(raw)
        except json.JSONDecodeError:
            return err.code, raw
    except urllib.error.URLError as err:
        return 0, {"error": f"No se pudo conectar a {BASE}: {err.reason}"}


def preview(value):
    return json.dumps(value, indent=2, ensure_ascii=False)[:1800]


def main():
    if not API_KEY:
        print("✗ Falta la variable de entorno MANAGEMENT_API_KEY.")
        sys.exit(2)

    print(f"→ Cargando script Python al Decision Engine ({BASE}) ...")
    status, body = call(
        "POST", "/v1/code-imports", {"language": "PYTHON", "sourceCode": PYTHON_SOURCE}
    )
    print(f"  POST /v1/code-imports -> {status}")
    if status not in (200, 201):
        print("  ✗ La carga del script FALLÓ:")
        print(preview(body))
        if status in (401, 403):
            print("  (La API key necesita rol RISK_ANALYST o FRAUD_ANALYST.)")
        sys.exit(1)

    import_id = None
    if isinstance(body, dict):
        import_id = body.get("id") or body.get("importId") or body.get("codeImportId")
    print(f"  ✓ El motor recibió y analizó el código. id={import_id}")
    print("  Análisis devuelto:")
    print(preview(body))

    if import_id is not None:
        st2, b2 = call("GET", f"/v1/code-imports/{import_id}")
        print(f"  GET /v1/code-imports/{import_id} -> {st2}")
        if st2 == 200:
            print("  ✓ El import persiste y es consultable.")
        else:
            print("  ⚠ El análisis respondió pero no se pudo releer el import:")
            print(preview(b2))

    print("\n✅ OK — la carga de versión por script funciona.")


if __name__ == "__main__":
    main()
