# Algoritmo de decisión de crédito — LISTO para "Importar Codigo".
#
# Pega TODO este archivo en "Importar Codigo" (o en un nodo Resultado con código).
# ANTES de analizar, pon el selector "Lenguaje" en Python: arranca en JavaScript, y
# analizado como JavaScript el motor responde un error de sintaxis en la linea 1 y
# "Missing @atlas-contract header" (busca la marca con "//", no con "#") aunque el
# archivo este perfecto. La pantalla ya lo detecta y ofrece cambiarlo de un clic.
# El bloque "# @atlas-contract" de abajo DECLARA las entradas y salidas: el
# importador lo exige antes del código (si falta, verás
# "Missing @atlas-contract header"). Debe ir en líneas de comentario "#", con un
# cuerpo JSON válido, y JUSTO DESPUES debe empezar el código (sin comentarios en
# medio). El motor inyecta `variables` (entradas) y tú asignas `result` (salidas).
#
# IMPORTANTE — los identificadores NO se inventan. Una importación se exige igual
# que cualquier artefacto: cada `id` del contrato tiene que ser un codigo que YA
# exista en el catalogo de variables, con el mismo tipo, y cada valor del motivo
# tiene que estar en el catalogo de motivos. Antes el motor creaba sola la
# variable que faltara (sin dueño ni clasificacion); ahora responde
# CODE_IMPORT_VARIABLE_NOT_IN_CATALOG y no deja guardar. Por eso este ejemplo usa
# los codigos reales del catalogo sembrado (monthly_income, bureau_score, age...)
# en vez de nombres bonitos en castellano: el nombre legible va en "name".
#
# Ademas, `credit_risk_decision` declara en el catalogo sus valores permitidos
# ("PASS", "REVIEW", "FAIL"). Escribir "APROBADO" ahi lo rechaza la validacion.
#
# Contrato del ejecutor: solo builtins seguros (abs, bool, dict, float, int, len,
# list, max, min, range, round, str, sum, tuple, zip); nada de import/try/class.
#
# Para que se derive el ARBOL (una condicion por cada if/elif y un resultado por
# rama) basta con que el codigo sea una cadena if/elif/else con su else final y
# que cada rama asigne un diccionario con las salidas declaradas. El diccionario
# puede ir en una linea o repartido en varias, como se escribe normalmente.

# @atlas-contract
# {
#   "contractVersion": "1",
#   "inputs": [
#     { "id": "monthly_income", "name": "Ingreso mensual", "type": "NUMBER", "required": true },
#     { "id": "existing_monthly_debt_payments", "name": "Deuda mensual", "type": "NUMBER", "required": false },
#     { "id": "bureau_score", "name": "Score de buro", "type": "INTEGER", "required": true },
#     { "id": "age", "name": "Edad", "type": "INTEGER", "required": true }
#   ],
#   "outputs": [
#     { "id": "credit_risk_decision", "name": "Decision", "type": "STRING", "required": true },
#     { "id": "adverse_action_reason_codes", "name": "Motivo", "type": "STRING", "required": true },
#     { "id": "approved_credit_limit", "name": "Limite aprobado", "type": "NUMBER", "required": false }
#   ],
#   "primaryOutputId": "credit_risk_decision",
#   "reasonOutputId": "adverse_action_reason_codes"
# }
ingreso = variables.get("monthly_income", 0)
deuda = variables.get("existing_monthly_debt_payments", 0)
score = variables.get("bureau_score", 0)
edad = variables.get("age", 0)

# Relacion deuda/ingreso (DTI). Sin ingreso, se trata como maximo riesgo.
ratio_deuda = deuda / ingreso if ingreso > 0 else 1.0

if edad < 18:
    result = {"credit_risk_decision": "FAIL", "adverse_action_reason_codes": "AGE_NOT_ELIGIBLE", "approved_credit_limit": 0}
elif ratio_deuda > 0.45:
    result = {"credit_risk_decision": "FAIL", "adverse_action_reason_codes": "AFFORDABILITY_RATIO_EXCEEDED", "approved_credit_limit": 0}
elif score < 550:
    result = {"credit_risk_decision": "FAIL", "adverse_action_reason_codes": "BUREAU_SCORE_TOO_LOW", "approved_credit_limit": 0}
elif score >= 700:
    result = {"credit_risk_decision": "PASS", "adverse_action_reason_codes": "APPROVED_POLICY", "approved_credit_limit": round(min(5000, ingreso * 0.35), 2)}
else:
    result = {"credit_risk_decision": "REVIEW", "adverse_action_reason_codes": "SCORE_BAND_BORDERLINE", "approved_credit_limit": 0}
