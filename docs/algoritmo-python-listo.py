# Algoritmo de decisión de crédito — LISTO para "Importar Código".
#
# Pega TODO este archivo en "Importar Código" (o en un nodo Resultado con código).
# El bloque "# @atlas-contract" de abajo DECLARA las entradas y salidas: el
# importador lo exige antes del código (si falta, verás
# "Missing @atlas-contract header"). Debe ir en líneas de comentario "#", con un
# cuerpo JSON válido, y JUSTO DESPUÉS debe empezar el código (sin comentarios en
# medio). El motor inyecta `variables` (entradas) y tú asignas `result` (salidas).
#
# Contrato del ejecutor: solo builtins seguros (abs, bool, dict, float, int, len,
# list, max, min, range, round, str, sum, tuple, zip); nada de import/try/class.

# @atlas-contract
# {
#   "contractVersion": "1",
#   "inputs": [
#     { "id": "ingreso_mensual", "name": "Ingreso mensual", "type": "NUMBER", "required": true },
#     { "id": "deuda_mensual", "name": "Deuda mensual", "type": "NUMBER", "required": false },
#     { "id": "score_buro", "name": "Score de buro", "type": "INTEGER", "required": true },
#     { "id": "edad", "name": "Edad", "type": "INTEGER", "required": true }
#   ],
#   "outputs": [
#     { "id": "decision", "name": "Decision", "type": "STRING", "required": true },
#     { "id": "motivo", "name": "Motivo", "type": "STRING", "required": true },
#     { "id": "limite", "name": "Limite recomendado", "type": "NUMBER", "required": false },
#     { "id": "riesgo", "name": "Nivel de riesgo", "type": "STRING", "required": false }
#   ],
#   "primaryOutputId": "decision"
# }
ingreso = variables.get("ingreso_mensual", 0)
deuda = variables.get("deuda_mensual", 0)
score = variables.get("score_buro", 0)
edad = variables.get("edad", 0)

# Relacion deuda/ingreso (DTI). Sin ingreso, se trata como maximo riesgo.
ratio_deuda = deuda / ingreso if ingreso > 0 else 1.0

if edad < 18:
    result = {"decision": "RECHAZADO", "motivo": "AGE_NOT_ELIGIBLE", "limite": 0, "riesgo": "ALTO"}
elif ratio_deuda > 0.45:
    result = {"decision": "RECHAZADO", "motivo": "DTI_TOO_HIGH", "limite": 0, "riesgo": "ALTO"}
elif score < 550:
    result = {"decision": "RECHAZADO", "motivo": "LOW_BUREAU_SCORE", "limite": 0, "riesgo": "ALTO"}
elif score >= 700:
    result = {
        "decision": "APROBADO",
        "motivo": "APPROVED_POLICY",
        "limite": round(min(5000, ingreso * 0.35), 2),
        "riesgo": "BAJO",
    }
else:
    result = {
        "decision": "REVISION_MANUAL",
        "motivo": "MANUAL_REVIEW_REQUIRED",
        "limite": 0,
        "riesgo": "MEDIO",
    }
