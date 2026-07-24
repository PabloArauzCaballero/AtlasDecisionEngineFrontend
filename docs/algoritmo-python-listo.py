# ─────────────────────────────────────────────────────────────────────────────
# ALGORITMO DE DECISIÓN LISTO EN PYTHON  —  copia y pega
# ─────────────────────────────────────────────────────────────────────────────
#
# Sirve para comprobar que la plataforma LEE y EJECUTA bien los scripts Python.
# Hay DOS formas de usarlo; el mismo código funciona en ambas:
#
# A) Nodo RESULT con código  (Editor de Grafo)
#    1. Declara las variables de ENTRADA (panel "Variables a considerar"):
#         ingreso_mensual (NUMBER), deuda_mensual (NUMBER),
#         score_buro (INTEGER), edad (INTEGER)
#    2. Declara las variables de SALIDA (panel "Contrato global de resultados"):
#         decision (STRING), motivo (STRING), limite (NUMBER)   -> marca `decision` como principal
#    3. Añade un nodo "Resultado", modo "Código controlado", lenguaje PYTHON, y pega
#       TODO este archivo (sin los comentarios de cabecera si quieres).
#    4. Requiere que el backend tenga SCRIPT_NODES_ENABLED=true.
#
# B) Importar Código  (menú "Importar Código")
#    Pega el mismo cuerpo; el analizador detecta las entradas (variables[...]) y las
#    salidas (claves de `result`) y te propone el contrato y el borrador de versión.
#
# CONTRATO DEL EJECUTOR (importante para que "lea bien"):
#   - Recibe el diccionario `variables` (y también `decision` y `output`).
#   - DEBE asignar un diccionario a `result`.
#   - Sólo builtins seguros: abs, bool, dict, float, int, len, list, max, min,
#     range, round, str, sum, tuple, zip. NO hay import, try, class, isinstance.
#   - Es determinista (sin fecha ni azar).
#
# Entrada de ejemplo: {"ingreso_mensual": 4000, "deuda_mensual": 800, "score_buro": 720, "edad": 30}
# Salida esperada:    {"decision": "APROBADO", "motivo": "APPROVED_POLICY", "limite": 1400.0, "riesgo": "BAJO"}
# ─────────────────────────────────────────────────────────────────────────────

ingreso = variables.get("ingreso_mensual", 0)
deuda = variables.get("deuda_mensual", 0)
score = variables.get("score_buro", 0)
edad = variables.get("edad", 0)

# Relación deuda/ingreso (DTI). Sin ingreso, se trata como máximo riesgo.
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
