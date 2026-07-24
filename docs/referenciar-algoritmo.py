#!/usr/bin/env python3
"""
Cómo REFERENCIAR otro algoritmo (árbol de decisión anidado, Fase 7).

Un algoritmo "padre" puede ejecutar a otro "hijo" dentro de un nodo de Resultado:
le pasa entradas desde sus variables y recibe las salidas del hijo. Este script
crea ese vínculo vía la API real y explica el paso que se hace en el editor.

Flujo completo:
  1) En el Editor de Grafo del PADRE: añade un nodo "Resultado", modo
     "Referenciar otro algoritmo". Eso deja el nodo con config.mode = "REFERENCE".
     Anota su clave (nodeKey), p. ej. "RESULT_1". Guarda el grafo.
  2) Corre este script para crear el VÍNCULO (qué hijo, qué versión, y el mapeo
     de entradas/salidas). El backend valida ciclos y profundidad automáticamente.

Requisitos: MANAGEMENT_API_KEY con rol RISK_ANALYST o FRAUD_ANALYST.

Uso (PowerShell):
    $env:MANAGEMENT_API_KEY = "<tu-key>"
    python docs/referenciar-algoritmo.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("DECISION_ENGINE_URL", "http://127.0.0.1:3000").rstrip("/")
API_KEY = os.environ.get("MANAGEMENT_API_KEY", "")
TENANT = os.environ.get("TENANT_ID", "1")

# ── Rellena estos IDs (los ves en Algoritmos y Versiones / detalle del artefacto) ──
PARENT_VERSION_ID = os.environ.get("PARENT_VERSION_ID", "<id-version-padre>")
CHILD_ARTIFACT_ID = os.environ.get("CHILD_ARTIFACT_ID", "<id-artefacto-hijo>")
CHILD_VERSION_ID = os.environ.get("CHILD_VERSION_ID", "<id-version-hijo>")
NODE_KEY = os.environ.get("NODE_KEY", "RESULT_1")  # la clave del nodo RESULT (mode REFERENCE)

# El vínculo: cómo se alimentan las entradas del hijo y qué salidas expone.
REFERENCE = {
    "nodeKey": NODE_KEY,
    "childArtifactId": CHILD_ARTIFACT_ID,
    "childArtifactVersionId": CHILD_VERSION_ID,
    # inputMapping: cada variable de ENTRADA del hijo, de dónde toma su valor.
    #   source=VARIABLE -> path apunta a una variable del flujo padre.
    #   source=LITERAL  -> value es un valor fijo.
    "inputMapping": [
        {"childVariableCode": "monthly_income", "source": "VARIABLE", "path": "ingreso_mensual"},
        {"childVariableCode": "has_active_debt", "source": "VARIABLE", "path": "tiene_deuda"},
    ],
    # outputMapping: qué salidas del hijo quedan disponibles para el padre.
    "outputMapping": [
        {"childOutputCode": "risk_level"},
    ],
    # Qué hacer si el hijo falla: FAIL (falla en cerrado) | FALLBACK | SKIP.
    "onErrorPolicy": "FAIL",
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
    if not API_KEY:
        print("✗ Falta MANAGEMENT_API_KEY.")
        sys.exit(2)
    if "<" in PARENT_VERSION_ID or "<" in CHILD_ARTIFACT_ID or "<" in CHILD_VERSION_ID:
        print("✗ Rellena PARENT_VERSION_ID, CHILD_ARTIFACT_ID y CHILD_VERSION_ID (arriba o por env).")
        sys.exit(2)

    path = f"/v1/artifact-versions/{PARENT_VERSION_ID}/references"
    print(f"→ Creando referencia en {BASE}{path} (nodo {NODE_KEY}) ...")
    status, body = call("POST", path, REFERENCE)
    print(f"  POST -> {status}")
    if status in (200, 201):
        print("  ✓ Referencia creada. El nodo ejecutará el algoritmo hijo.")
        print(json.dumps(body, indent=2, ensure_ascii=False)[:1200])
    elif status == 409:
        # El backend impide ciclos y exceso de profundidad.
        print("  ⚠ Conflicto (posible ciclo o profundidad máxima):")
        print(json.dumps(body, indent=2, ensure_ascii=False)[:800])
    else:
        print("  ✗ No se pudo crear la referencia:")
        print(json.dumps(body, indent=2, ensure_ascii=False)[:800])

    # Ver todas las referencias de esta versión (útil para confirmar).
    st2, refs = call("GET", path)
    if st2 == 200:
        count = len(refs if isinstance(refs, list) else refs.get("items", []))
        print(f"  Referencias en la versión: {count}")


if __name__ == "__main__":
    main()
