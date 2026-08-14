#!/usr/bin/env python3
"""
Siembra una FAMILIA de árboles de decisión ANIDADOS (Fase 7).

Cinco algoritmos de originación de crédito que se referencian entre sí. El
objetivo es que el grafo de dependencias tenga los DOS paneles poblados a la vez
—«Depende de» y «Referenciado por»—, y que lo que muestren se sostenga como
política de crédito. El diseño y el porqué están en `docs/arboles-anidados.md`.

        ORIGINACION_CONSUMO        LIMITE_TARJETA_CREDITO
                    \\                    /
                     RIESGO_CREDITICIO          <- los dos paneles, poblados
                       /              \\
        CAPACIDAD_PAGO_CONSUMO      SOLVENCIA_BURO

A diferencia de `seed_algorithms.py`, este script SÍ arma el grafo de cada árbol
(`PUT .../graph`), lo valida y lo compila: sin compilar al hijo el motor rechaza
la referencia con `CHILD_VERSION_NOT_COMPILED`, así que va de abajo hacia arriba.

Solo librería estándar. Idempotente: lo que ya existe se omite (409).

Uso (PowerShell):
    $env:MANAGEMENT_API_KEY = "<tu-key>"
    python docs/seed-arboles-anidados.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("DECISION_ENGINE_URL", "http://127.0.0.1:3000").rstrip("/")
API_KEY = os.environ.get("MANAGEMENT_API_KEY", "")
TENANT = os.environ.get("TENANT_ID", "1")

# El `path` de un inputMapping: código pelado, igual que `referenciar-algoritmo.py`.
# Si tu motor espera la ruta larga, cambia esto por f"input.{codigo}".
MAPEO_DIRECTO = lambda codigo: codigo  # noqa: E731

# ── Catálogo ──────────────────────────────────────────────────────────────────
# (código, nombre, tipo lógico, descripción). Los tipos se traducen al enum real
# del motor con /v1/views/options, que es quien manda.

ENTRADAS = [
    ("edad", "Edad", "INTEGER", "Edad del solicitante en años"),
    ("ingreso_mensual", "Ingreso mensual", "NUMBER", "Ingreso neto mensual"),
    ("deuda_mensual", "Deuda mensual", "NUMBER", "Cuotas de deuda ya comprometidas"),
    ("monto", "Monto solicitado", "NUMBER", "Importe del crédito solicitado"),
    ("plazo_meses", "Plazo en meses", "INTEGER", "Meses de amortización solicitados"),
    ("cupo_solicitado", "Cupo solicitado", "NUMBER", "Cupo de tarjeta solicitado"),
    ("score_buro", "Score de buró", "INTEGER", "Score de buró de crédito (300-850)"),
    ("antiguedad_laboral_meses", "Antigüedad laboral", "INTEGER", "Meses en el empleo actual"),
    ("documento_valido", "Documento válido", "BOOLEAN", "Identidad verificada"),
    ("en_lista_sanciones", "En lista de sanciones", "BOOLEAN", "Coincidencia en listas"),
]

SALIDAS = [
    ("nivel_riesgo_capacidad", "Nivel de riesgo por capacidad", "STRING", "BAJO | MEDIO | ALTO"),
    ("motivo_capacidad", "Motivo de capacidad", "STRING", "Explicación de la lectura de cuota"),
    ("recomendacion_capacidad", "Recomendación por capacidad", "STRING", "APROBAR | REVISAR | RECHAZAR"),
    ("dti_resultante", "DTI resultante", "NUMBER", "Cuota más deuda sobre ingreso (diagnóstico)"),
    ("nivel_riesgo_solvencia", "Nivel de riesgo por solvencia", "STRING", "BAJO | MEDIO | ALTO"),
    ("motivo_solvencia", "Motivo de solvencia", "STRING", "Explicación de la lectura de historial"),
    ("recomendacion_solvencia", "Recomendación por solvencia", "STRING", "APROBAR | REVISAR | RECHAZAR"),
    ("riesgo_nivel", "Nivel de riesgo", "STRING", "Veredicto de riesgo del solicitante"),
    ("riesgo_motivo", "Motivo del riesgo", "STRING", "Razón que sustenta el veredicto"),
    ("riesgo_recomendacion", "Recomendación de riesgo", "STRING", "APROBAR | REVISAR | RECHAZAR"),
    ("decision_originacion", "Decisión de originación", "STRING", "APROBAR | REVISAR | RECHAZAR"),
    ("motivo_originacion", "Motivo de originación", "STRING", "Razón entregada al solicitante"),
    ("decision_tarjeta", "Decisión de tarjeta", "STRING", "APROBAR | REVISAR | RECHAZAR"),
    ("motivo_tarjeta", "Motivo de tarjeta", "STRING", "Razón entregada al solicitante"),
]

# ── Expresiones compartidas ───────────────────────────────────────────────────
# Forma de ÁRBOL (`{op, left, right}`): la que producen compilador y seeders, y
# la única que admite aritmética. El editor la lee y la muestra como compuesta.

CUOTA_MAS_DEUDA = {
    "op": "add",
    "left": {"var": "deuda_mensual"},
    "right": {"op": "div", "left": {"var": "monto"}, "right": {"var": "plazo_meses"}},
}


def dti(umbral):
    """Cuota estimada más deuda vigente, sobre el ingreso, contra un umbral."""
    return {
        "op": "lte",
        "left": {"op": "div", "left": CUOTA_MAS_DEUDA, "right": {"var": "ingreso_mensual"}},
        "right": {"value": umbral},
    }


def razon(variable, divisor, operador, umbral):
    return {
        "op": operador,
        "left": {"op": "div", "left": {"var": variable}, "right": {"var": divisor}},
        "right": {"value": umbral},
    }


# ── Constructores de grafo ────────────────────────────────────────────────────


def condicion(code, name, expression):
    return {
        "code": code,
        "name": name,
        "expressionType": "JSON_AST",
        "expression": expression,
        "severity": "BLOCKING",
        "reusable": False,
    }


def nodo(key, tipo, label, x, y, orden, config=None, cond_code=None):
    terminal = tipo in ("RESULT", "END", "MANUAL_REVIEW")
    return {
        "key": key,
        "type": tipo,
        "label": label,
        "config": config or ({"conditionCode": cond_code} if cond_code else {}),
        "x": x,
        "y": y,
        "order": orden,
        "terminal": terminal,
        "conditions": [{"conditionCode": cond_code, "order": 1, "expected": True}] if cond_code else [],
        "actions": [],
        "calculatedFieldCalls": [],
    }


def resultado(key, label, x, y, orden, asignaciones):
    config = {"mode": "MAPPING", "assignments": asignaciones}
    return nodo(key, "RESULT", label, x, y, orden, config=config)


def referencia(key, label, x, y, orden, mapeo_salidas):
    """RESULT en modo REFERENCE: el hijo responde y su respuesta cierra la rama."""
    config = {
        "mode": "REFERENCE",
        "outputAssignments": [
            {"outputCode": propio, "childOutputCode": hijo} for propio, hijo in mapeo_salidas
        ],
    }
    return nodo(key, "RESULT", label, x, y, orden, config=config)


def literal(codigo, valor):
    return {"outputCode": codigo, "source": "LITERAL", "value": valor}


def expresion(codigo, ast):
    return {"outputCode": codigo, "source": "EXPRESSION", "expression": ast}


def rama_falsa(desde, hacia):
    """La salida por defecto de una condición: fail-closed, sin condición atada."""
    return {"key": f"{desde}__{hacia}", "from": desde, "to": hacia,
            "type": "DEFAULT", "priority": 1, "default": True, "conditions": []}


def rama_cierta(desde, hacia, cond_code):
    return {"key": f"{desde}__{hacia}", "from": desde, "to": hacia,
            "type": "CONDITIONAL", "priority": 2, "default": False,
            "conditions": [{"conditionCode": cond_code, "order": 1}]}


def paso(desde, hacia):
    return rama_falsa(desde, hacia)


def contrato(codigo, nodo_origen, tipo_origen="NODE"):
    return {
        "code": codigo,
        "name": codigo,
        "description": "",
        "sourceKind": tipo_origen,
        "sourceRef": nodo_origen,
        "absenceReasons": [],
        "reasonCodes": [],
        "contractVersion": "1",
        "sensitivityClass": "INTERNAL",
        "tracePolicy": "FULL",
    }


# ── Los cinco árboles ─────────────────────────────────────────────────────────


def arbol_capacidad():
    """¿La cuota cabe en el bolsillo? Aritmética pura de ingreso y deuda."""
    def veredicto(nivel, texto, reco):
        return [
            literal("nivel_riesgo_capacidad", nivel),
            literal("motivo_capacidad", texto),
            literal("recomendacion_capacidad", reco),
            expresion("dti_resultante",
                      {"op": "div", "left": CUOTA_MAS_DEUDA, "right": {"var": "ingreso_mensual"}}),
        ]

    return {
        "conditions": [
            condicion("CP_INGRESO_DECLARADO", "Hay ingreso declarado",
                      {"variable": "ingreso_mensual", "operator": "gt", "value": 0}),
            condicion("CP_DTI_HOLGADO", "La cuota compromete menos del 30 %", dti(0.30)),
            condicion("CP_DTI_LIMITE", "La cuota compromete hasta el 45 %", dti(0.45)),
        ],
        "nodes": [
            nodo("INICIO", "START", "Inicio", 6, 40, 1),
            nodo("VER_INGRESO", "CONDITION", "¿Hay ingreso declarado?", 22, 40, 2,
                 cond_code="CP_INGRESO_DECLARADO"),
            # Sin ingreso no hay DTI que calcular: dividir por cero no es «riesgo
            # bajo», es ausencia de dato, y se deriva a una persona.
            resultado("SIN_INGRESO", "Sin ingreso declarado", 42, 74, 3, [
                literal("nivel_riesgo_capacidad", "ALTO"),
                literal("motivo_capacidad",
                        "No hay ingreso declarado: la capacidad de pago no puede evaluarse."),
                literal("recomendacion_capacidad", "REVISAR"),
                literal("dti_resultante", -1),
            ]),
            nodo("DTI_HOLGADO", "CONDITION", "¿DTI bajo el 30 %?", 42, 26, 4,
                 cond_code="CP_DTI_HOLGADO"),
            resultado("CAP_HOLGADA", "Capacidad holgada", 66, 8, 5,
                      veredicto("BAJO", "La cuota estimada compromete menos del 30 % del ingreso.",
                                "APROBAR")),
            nodo("DTI_LIMITE", "CONDITION", "¿DTI bajo el 45 %?", 62, 44, 6,
                 cond_code="CP_DTI_LIMITE"),
            resultado("CAP_AJUSTADA", "Capacidad ajustada", 84, 30, 7,
                      veredicto("MEDIO", "La cuota estimada compromete entre el 30 % y el 45 % "
                                         "del ingreso.", "REVISAR")),
            resultado("CAP_INSUFICIENTE", "Capacidad insuficiente", 84, 62, 8,
                      veredicto("ALTO", "La cuota estimada supera el 45 % del ingreso.",
                                "RECHAZAR")),
        ],
        "edges": [
            paso("INICIO", "VER_INGRESO"),
            rama_falsa("VER_INGRESO", "SIN_INGRESO"),
            rama_cierta("VER_INGRESO", "DTI_HOLGADO", "CP_INGRESO_DECLARADO"),
            rama_falsa("DTI_HOLGADO", "DTI_LIMITE"),
            rama_cierta("DTI_HOLGADO", "CAP_HOLGADA", "CP_DTI_HOLGADO"),
            rama_falsa("DTI_LIMITE", "CAP_INSUFICIENTE"),
            rama_cierta("DTI_LIMITE", "CAP_AJUSTADA", "CP_DTI_LIMITE"),
        ],
        "outputContract": [
            contrato("nivel_riesgo_capacidad", "CAP_HOLGADA"),
            contrato("motivo_capacidad", "CAP_HOLGADA"),
            contrato("recomendacion_capacidad", "CAP_HOLGADA"),
            contrato("dti_resultante", "CAP_HOLGADA"),
        ],
    }


def arbol_solvencia():
    """¿El comportamiento de pago pasado respalda? Buró y estabilidad laboral."""
    def veredicto(nivel, texto, reco):
        return [
            literal("nivel_riesgo_solvencia", nivel),
            literal("motivo_solvencia", texto),
            literal("recomendacion_solvencia", reco),
        ]

    return {
        "conditions": [
            condicion("SB_SCORE_ALTO", "Score de 720 o más",
                      {"variable": "score_buro", "operator": "gte", "value": 720}),
            condicion("SB_SCORE_MEDIO", "Score de 620 o más",
                      {"variable": "score_buro", "operator": "gte", "value": 620}),
            condicion("SB_EMPLEO_ESTABLE", "Un año o más en el empleo actual",
                      {"variable": "antiguedad_laboral_meses", "operator": "gte", "value": 12}),
        ],
        "nodes": [
            nodo("INICIO", "START", "Inicio", 6, 40, 1),
            nodo("SCORE_ALTO", "CONDITION", "¿Score ≥ 720?", 22, 40, 2, cond_code="SB_SCORE_ALTO"),
            resultado("SOL_ALTA", "Solvencia alta", 44, 10, 3,
                      veredicto("BAJO", "Score de buró de 720 o más.", "APROBAR")),
            nodo("SCORE_MEDIO", "CONDITION", "¿Score ≥ 620?", 42, 52, 4,
                 cond_code="SB_SCORE_MEDIO"),
            nodo("EMPLEO", "CONDITION", "¿Un año en el empleo?", 62, 36, 5,
                 cond_code="SB_EMPLEO_ESTABLE"),
            resultado("SOL_MEDIA", "Solvencia media", 84, 22, 6,
                      veredicto("MEDIO", "Score intermedio con empleo estable de un año o más.",
                                "REVISAR")),
            # Un score intermedio sin antigüedad que lo sostenga no es «medio»:
            # el historial puede ser reciente y no haber pasado un mal mes.
            resultado("SOL_FRAGIL", "Solvencia frágil", 84, 50, 7,
                      veredicto("ALTO", "Score intermedio sin antigüedad laboral que lo respalde.",
                                "RECHAZAR")),
            resultado("SOL_BAJA", "Solvencia baja", 62, 76, 8,
                      veredicto("ALTO", "Score de buró por debajo de 620.", "RECHAZAR")),
        ],
        "edges": [
            paso("INICIO", "SCORE_ALTO"),
            rama_falsa("SCORE_ALTO", "SCORE_MEDIO"),
            rama_cierta("SCORE_ALTO", "SOL_ALTA", "SB_SCORE_ALTO"),
            rama_falsa("SCORE_MEDIO", "SOL_BAJA"),
            rama_cierta("SCORE_MEDIO", "EMPLEO", "SB_SCORE_MEDIO"),
            rama_falsa("EMPLEO", "SOL_FRAGIL"),
            rama_cierta("EMPLEO", "SOL_MEDIA", "SB_EMPLEO_ESTABLE"),
        ],
        "outputContract": [
            contrato("nivel_riesgo_solvencia", "SOL_ALTA"),
            contrato("motivo_solvencia", "SOL_ALTA"),
            contrato("recomendacion_solvencia", "SOL_ALTA"),
        ],
    }


def arbol_riesgo():
    """Decide CUÁL de las dos lecturas manda, y republica su veredicto."""
    mapeo = lambda sufijo: [  # noqa: E731
        ("riesgo_nivel", f"nivel_riesgo_{sufijo}"),
        ("riesgo_motivo", f"motivo_{sufijo}"),
        ("riesgo_recomendacion", f"recomendacion_{sufijo}"),
    ]
    return {
        "conditions": [
            # Cinco ingresos mensuales: por encima de ahí lo que decide es si la
            # cuota cabe, no cómo pagó el solicitante tickets mucho menores.
            condicion("RC_EXPOSICION_MATERIAL", "El monto supera cinco ingresos mensuales",
                      razon("monto", "ingreso_mensual", "gte", 5)),
        ],
        "nodes": [
            nodo("INICIO", "START", "Inicio", 8, 40, 1),
            nodo("EXPOSICION", "CONDITION", "¿Exposición material?", 30, 40, 2,
                 cond_code="RC_EXPOSICION_MATERIAL"),
            referencia("RIESGO_POR_SOLVENCIA", "Riesgo por historial de pago", 62, 66, 3,
                       mapeo("solvencia")),
            referencia("RIESGO_POR_CAPACIDAD", "Riesgo por capacidad de pago", 62, 16, 4,
                       mapeo("capacidad")),
        ],
        "edges": [
            paso("INICIO", "EXPOSICION"),
            rama_falsa("EXPOSICION", "RIESGO_POR_SOLVENCIA"),
            rama_cierta("EXPOSICION", "RIESGO_POR_CAPACIDAD", "RC_EXPOSICION_MATERIAL"),
        ],
        "outputContract": [
            contrato("riesgo_nivel", "RIESGO_POR_CAPACIDAD", "REFERENCE"),
            contrato("riesgo_motivo", "RIESGO_POR_CAPACIDAD", "REFERENCE"),
            contrato("riesgo_recomendacion", "RIESGO_POR_CAPACIDAD", "REFERENCE"),
        ],
    }


def arbol_originacion():
    """Elegibilidad dura primero; el riesgo sólo si el solicitante puede pasar."""
    def rechazo(key, label, x, y, orden, texto):
        return resultado(key, label, x, y, orden, [
            literal("decision_originacion", "RECHAZAR"),
            literal("motivo_originacion", texto),
        ])

    return {
        "conditions": [
            condicion("OC_IDENTIDAD_VALIDA", "El documento es válido",
                      {"variable": "documento_valido", "operator": "eq", "value": True}),
            condicion("OC_SIN_SANCIONES", "No figura en listas de sanciones",
                      {"variable": "en_lista_sanciones", "operator": "eq", "value": False}),
            condicion("OC_EDAD_ELEGIBLE", "Mayor de edad",
                      {"variable": "edad", "operator": "gte", "value": 18}),
        ],
        "nodes": [
            nodo("INICIO", "START", "Inicio", 4, 44, 1),
            nodo("IDENTIDAD", "CONDITION", "¿Documento válido?", 18, 44, 2,
                 cond_code="OC_IDENTIDAD_VALIDA"),
            rechazo("RECHAZO_IDENTIDAD", "Rechazo por identidad", 18, 78, 3,
                    "El documento de identidad no es válido."),
            nodo("SANCIONES", "CONDITION", "¿Fuera de sanciones?", 38, 44, 4,
                 cond_code="OC_SIN_SANCIONES"),
            rechazo("RECHAZO_SANCIONES", "Rechazo por sanciones", 38, 78, 5,
                    "El solicitante figura en listas de sanciones."),
            nodo("EDAD", "CONDITION", "¿Mayor de edad?", 58, 44, 6,
                 cond_code="OC_EDAD_ELEGIBLE"),
            rechazo("RECHAZO_EDAD", "Rechazo por edad", 58, 78, 7,
                    "No cumple la edad mínima de 18 años."),
            referencia("EVALUA_RIESGO", "Evaluación de riesgo crediticio", 82, 30, 8, [
                ("decision_originacion", "riesgo_recomendacion"),
                ("motivo_originacion", "riesgo_motivo"),
            ]),
        ],
        "edges": [
            paso("INICIO", "IDENTIDAD"),
            rama_falsa("IDENTIDAD", "RECHAZO_IDENTIDAD"),
            rama_cierta("IDENTIDAD", "SANCIONES", "OC_IDENTIDAD_VALIDA"),
            rama_falsa("SANCIONES", "RECHAZO_SANCIONES"),
            rama_cierta("SANCIONES", "EDAD", "OC_SIN_SANCIONES"),
            rama_falsa("EDAD", "RECHAZO_EDAD"),
            rama_cierta("EDAD", "EVALUA_RIESGO", "OC_EDAD_ELEGIBLE"),
        ],
        "outputContract": [
            contrato("decision_originacion", "EVALUA_RIESGO", "REFERENCE"),
            contrato("motivo_originacion", "EVALUA_RIESGO", "REFERENCE"),
        ],
    }


def arbol_tarjeta():
    """Otro producto, otras reglas duras, el MISMO motor de riesgo."""
    def rechazo(key, label, x, y, orden, texto):
        return resultado(key, label, x, y, orden, [
            literal("decision_tarjeta", "RECHAZAR"),
            literal("motivo_tarjeta", texto),
        ])

    return {
        "conditions": [
            condicion("LT_IDENTIDAD_VALIDA", "El documento es válido",
                      {"variable": "documento_valido", "operator": "eq", "value": True}),
            condicion("LT_CUPO_RAZONABLE", "El cupo no supera tres ingresos mensuales",
                      razon("cupo_solicitado", "ingreso_mensual", "lte", 3)),
        ],
        "nodes": [
            nodo("INICIO", "START", "Inicio", 6, 44, 1),
            nodo("IDENTIDAD", "CONDITION", "¿Documento válido?", 24, 44, 2,
                 cond_code="LT_IDENTIDAD_VALIDA"),
            rechazo("TC_RECHAZO_IDENTIDAD", "Rechazo por identidad", 24, 78, 3,
                    "El documento de identidad no es válido."),
            nodo("CUPO", "CONDITION", "¿Cupo razonable?", 48, 44, 4,
                 cond_code="LT_CUPO_RAZONABLE"),
            rechazo("TC_RECHAZO_CUPO", "Rechazo por cupo", 48, 78, 5,
                    "El cupo solicitado supera tres ingresos mensuales."),
            referencia("TC_EVALUA_RIESGO", "Evaluación de riesgo crediticio", 76, 30, 6, [
                ("decision_tarjeta", "riesgo_recomendacion"),
                ("motivo_tarjeta", "riesgo_motivo"),
            ]),
        ],
        "edges": [
            paso("INICIO", "IDENTIDAD"),
            rama_falsa("IDENTIDAD", "TC_RECHAZO_IDENTIDAD"),
            rama_cierta("IDENTIDAD", "CUPO", "LT_IDENTIDAD_VALIDA"),
            rama_falsa("CUPO", "TC_RECHAZO_CUPO"),
            rama_cierta("CUPO", "TC_EVALUA_RIESGO", "LT_CUPO_RAZONABLE"),
        ],
        "outputContract": [
            contrato("decision_tarjeta", "TC_EVALUA_RIESGO", "REFERENCE"),
            contrato("motivo_tarjeta", "TC_EVALUA_RIESGO", "REFERENCE"),
        ],
    }


def directo(*codigos):
    return [{"childVariableCode": c, "source": "VARIABLE", "path": MAPEO_DIRECTO(c)}
            for c in codigos]


ENTRADAS_RIESGO = ("ingreso_mensual", "deuda_mensual", "monto", "plazo_meses",
                   "score_buro", "antiguedad_laboral_meses")

# Orden de siembra: de las hojas hacia las raíces. El motor exige que el hijo
# esté COMPILADO antes de que nadie lo referencie.
FAMILIA = [
    {
        "code": "CAPACIDAD_PAGO_CONSUMO",
        "name": "Capacidad de pago de consumo",
        "purpose": "Medir si la cuota estimada cabe en el ingreso del solicitante.",
        "inputs": ["ingreso_mensual", "deuda_mensual", "monto", "plazo_meses"],
        "outputs": [("nivel_riesgo_capacidad", True), ("motivo_capacidad", False),
                    ("recomendacion_capacidad", False), ("dti_resultante", False)],
        "graph": arbol_capacidad,
        "references": [],
    },
    {
        "code": "SOLVENCIA_BURO",
        "name": "Solvencia de buró",
        "purpose": "Medir si el comportamiento de pago pasado respalda al solicitante.",
        "inputs": ["score_buro", "antiguedad_laboral_meses"],
        "outputs": [("nivel_riesgo_solvencia", True), ("motivo_solvencia", False),
                    ("recomendacion_solvencia", False)],
        "graph": arbol_solvencia,
        "references": [],
    },
    {
        "code": "RIESGO_CREDITICIO",
        "name": "Riesgo crediticio del solicitante",
        "purpose": "Elegir la lectura de riesgo que corresponde a la exposición y publicarla.",
        "inputs": list(ENTRADAS_RIESGO),
        "outputs": [("riesgo_nivel", True), ("riesgo_motivo", False),
                    ("riesgo_recomendacion", False)],
        "graph": arbol_riesgo,
        "references": [
            {
                "nodeKey": "RIESGO_POR_CAPACIDAD",
                "child": "CAPACIDAD_PAGO_CONSUMO",
                "inputMapping": directo("ingreso_mensual", "deuda_mensual", "monto", "plazo_meses"),
                "outputMapping": [{"childOutputCode": "nivel_riesgo_capacidad"},
                                  {"childOutputCode": "motivo_capacidad"},
                                  {"childOutputCode": "recomendacion_capacidad"}],
            },
            {
                "nodeKey": "RIESGO_POR_SOLVENCIA",
                "child": "SOLVENCIA_BURO",
                "inputMapping": directo("score_buro", "antiguedad_laboral_meses"),
                "outputMapping": [{"childOutputCode": "nivel_riesgo_solvencia"},
                                  {"childOutputCode": "motivo_solvencia"},
                                  {"childOutputCode": "recomendacion_solvencia"}],
            },
        ],
    },
    {
        "code": "ORIGINACION_CONSUMO",
        "name": "Originación de crédito de consumo",
        "purpose": "Decidir si se otorga un préstamo de consumo y con qué motivo.",
        "inputs": ["edad", "documento_valido", "en_lista_sanciones", *ENTRADAS_RIESGO],
        "outputs": [("decision_originacion", True), ("motivo_originacion", False)],
        "graph": arbol_originacion,
        "references": [
            {
                "nodeKey": "EVALUA_RIESGO",
                "child": "RIESGO_CREDITICIO",
                "inputMapping": directo(*ENTRADAS_RIESGO),
                "outputMapping": [{"childOutputCode": "riesgo_recomendacion"},
                                  {"childOutputCode": "riesgo_motivo"}],
            },
        ],
    },
    {
        "code": "LIMITE_TARJETA_CREDITO",
        "name": "Límite de tarjeta de crédito",
        "purpose": "Decidir si se otorga una tarjeta con el cupo solicitado.",
        "inputs": ["documento_valido", "cupo_solicitado", "ingreso_mensual", "deuda_mensual",
                   "score_buro", "antiguedad_laboral_meses"],
        "outputs": [("decision_tarjeta", True), ("motivo_tarjeta", False)],
        "graph": arbol_tarjeta,
        "references": [
            {
                "nodeKey": "TC_EVALUA_RIESGO",
                "child": "RIESGO_CREDITICIO",
                # Una tarjeta no tiene monto ni plazo. El cupo hace de monto y el
                # plazo es un supuesto de política declarado AQUÍ, donde se audita.
                "inputMapping": [
                    *directo("ingreso_mensual", "deuda_mensual", "score_buro",
                             "antiguedad_laboral_meses"),
                    {"childVariableCode": "monto", "source": "VARIABLE",
                     "path": MAPEO_DIRECTO("cupo_solicitado")},
                    {"childVariableCode": "plazo_meses", "source": "LITERAL", "value": 12},
                ],
                "outputMapping": [{"childOutputCode": "riesgo_recomendacion"},
                                  {"childOutputCode": "riesgo_motivo"}],
            },
        ],
    },
]


# ── Transporte ────────────────────────────────────────────────────────────────


def call(method, path, body=None, headers=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("content-type", "application/json")
    req.add_header("x-api-key", API_KEY)
    req.add_header("x-tenant-id", TENANT)
    for name, value in (headers or {}).items():
        req.add_header(name, value)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read().decode("utf-8") or "null")
        except json.JSONDecodeError:
            return err.code, None
    except urllib.error.URLError as err:
        print(f"✗ No se pudo conectar a {BASE}: {err.reason}")
        sys.exit(2)


def detalle(body, limite=400):
    return json.dumps(body, indent=2, ensure_ascii=False)[:limite] if body else "(sin cuerpo)"


def option(group, *prefer):
    """No adivinamos enums: los pide al catálogo del motor."""
    _, body = call("GET", f"/v1/views/options?group={group}")
    values = [str(item.get("value")) for item in (body or []) if isinstance(item, dict)]
    for wanted in prefer:
        for value in values:
            if wanted.upper() in value.upper():
                return value
    return values[0] if values else (prefer[0] if prefer else "")


def picker(nombre):
    _, body = call("GET", f"/v1/views/pickers/{nombre}")
    return [row for row in (body or []) if isinstance(row, dict)]


# ── Pasos ─────────────────────────────────────────────────────────────────────


def sembrar_variables(enums):
    print("Variables del catálogo:")
    for code, name, dtype, desc in [*ENTRADAS, *SALIDAS]:
        status, body = call("POST", "/v1/variables", {
            "variableCode": code,
            "canonicalName": name,
            "businessDescription": desc,
            "dataClassification": enums["classification"],
            "ownerTeam": enums["owner"],
            "isSensitive": False,
            "initialVersion": {
                "dataType": enums["types"][dtype],
                "nullable": False,
                "sources": [],
                "validationRules": [],
            },
        })
        if status in (200, 201):
            print(f"  ✓ {code}")
        elif status == 409:
            print(f"  = {code} ya existía")
        else:
            print(f"  ✗ {code} -> {status} {detalle(body, 200)}")


def asegurar_artefacto(arbol, enums):
    """Devuelve (artifactId, versionId, lockVersion, status) creando si hace falta."""
    call("POST", "/v1/artifacts", {
        "artifactCode": arbol["code"],
        "name": arbol["name"],
        "artifactType": enums["art_type"],
        "ownerTeam": enums["owner"],
        "businessPurpose": arbol["purpose"],
        "riskDomain": enums["domain"],
        "semanticVersion": "1.0.0",
    })
    fila = next((r for r in picker("artifacts") if r.get("artifactCode") == arbol["code"]), None)
    if not fila:
        return None
    artifact_id = str(fila.get("id"))
    status, body = call("GET", f"/v1/artifacts/{artifact_id}")
    versiones = (body or {}).get("versions") or []
    if not versiones:
        print(f"  ✗ {arbol['code']}: el artefacto no trae versiones ({status})")
        return None
    # La editable es la DRAFT; si ya se compiló en una corrida previa, se reusa.
    version = next((v for v in versiones if v.get("status") == "DRAFT"), versiones[0])
    return artifact_id, str(version.get("id")), str(version.get("lockVersion", "0")), \
        str(version.get("status"))


def dependencias(arbol, variables_por_codigo):
    filas = []
    for code in arbol["inputs"]:
        fila = variables_por_codigo.get(code)
        if not fila:
            print(f"  ⚠ falta la variable de entrada {code} en el catálogo")
            continue
        filas.append({
            "variableVersionId": str(fila["latestVersionId"]),
            "usageType": "INPUT",
            "isRequired": True,
            "fallbackPolicy": "FAIL_CLOSED",
            "dependencyPath": f"input.{code}",
        })
    for code, primaria in arbol["outputs"]:
        fila = variables_por_codigo.get(code)
        if not fila:
            print(f"  ⚠ falta la variable de salida {code} en el catálogo")
            continue
        filas.append({
            "variableVersionId": str(fila["latestVersionId"]),
            "usageType": "OUTPUT_PRIMARY" if primaria else "OUTPUT",
            "isRequired": True,
            "fallbackPolicy": "FAIL_CLOSED",
            "dependencyPath": f"output.{code}",
        })
    return filas


def guardar_grafo(version_id, lock, cuerpo):
    """PUT con `if-match`. Si el contrato de salida estorba, reintenta sin él."""
    ruta = f"/v1/artifact-versions/{version_id}/graph"
    status, body = call("PUT", ruta, cuerpo, headers={"if-match": lock})
    if status in (200, 201):
        return True, str((body or {}).get("lockVersion", lock))
    if status in (400, 422) and cuerpo.get("outputContract"):
        print(f"  ⚠ el motor rechazó el grafo ({status}); reintento sin outputContract")
        print(f"    {detalle(body, 300)}")
        recorte = {**cuerpo, "outputContract": []}
        status, body = call("PUT", ruta, recorte, headers={"if-match": lock})
        if status in (200, 201):
            print("    ✓ guardado sin contrato de salida (complétalo en el editor)")
            return True, str((body or {}).get("lockVersion", lock))
    print(f"  ✗ no se pudo guardar el grafo -> {status}")
    print(f"    {detalle(body)}")
    return False, lock


def compilar(version_id, estado):
    if estado == "COMPILED":
        print("  = la versión ya estaba compilada")
        return True
    status, body = call("POST", f"/v1/artifact-versions/{version_id}/validate", {})
    if status not in (200, 201):
        print(f"  ✗ validate -> {status} {detalle(body)}")
        return False
    print("  ✓ validada")
    status, body = call("POST", f"/v1/artifact-versions/{version_id}/compile", {})
    if status not in (200, 201):
        print(f"  ✗ compile -> {status} {detalle(body)}")
        return False
    print("  ✓ compilada")
    return True


def vincular(version_id, ref, hijos):
    """POST del vínculo padre→hijo. El motor valida ciclos y profundidad."""
    hijo = hijos.get(ref["child"])
    if not hijo:
        print(f"  ✗ el hijo {ref['child']} no está sembrado; se omite la referencia")
        return False
    ruta = f"/v1/artifact-versions/{version_id}/references"
    _, existentes = call("GET", ruta)
    filas = existentes if isinstance(existentes, list) else (existentes or {}).get("items", [])
    if any(str(f.get("nodeKey")) == ref["nodeKey"] for f in filas or []):
        print(f"  = {ref['nodeKey']} → {ref['child']} ya estaba vinculado")
        return True
    status, body = call("POST", ruta, {
        "nodeKey": ref["nodeKey"],
        "childArtifactId": hijo["artifactId"],
        "childArtifactVersionId": hijo["versionId"],
        "inputMapping": ref["inputMapping"],
        "outputMapping": ref["outputMapping"],
        "onErrorPolicy": "FAIL",
        "versionSelection": "EXACT",
        "maxRetries": 0,
        "retryDelayMs": 0,
        "isRequired": True,
        "tracePolicy": "FULL",
    })
    if status in (200, 201):
        print(f"  ✓ {ref['nodeKey']} → {ref['child']}")
        return True
    print(f"  ✗ {ref['nodeKey']} → {ref['child']} -> {status}")
    print(f"    {detalle(body)}")
    return False


def main():
    if not API_KEY:
        print("✗ Falta MANAGEMENT_API_KEY.")
        sys.exit(2)

    print(f"→ Sembrando árboles anidados en {BASE} (tenant {TENANT})\n")
    enums = {
        "classification": option("dataClassification", "INTERNAL", "CONFIDENTIAL"),
        "owner": option("ownerTeam", "RISK", "DECISION"),
        "art_type": option("artifactType", "DECISION_TREE", "DECISION", "RULESET"),
        "domain": option("riskDomain", "CREDIT", "CREDITO"),
        "types": {t: option("variableDataType", *p) for t, p in {
            "INTEGER": ("INTEGER", "INT", "LONG"),
            "NUMBER": ("DECIMAL", "NUMBER", "FLOAT"),
            "STRING": ("STRING", "TEXT"),
            "BOOLEAN": ("BOOLEAN", "BOOL"),
        }.items()},
    }
    sembrar_variables(enums)

    variables = {str(r.get("variableCode")): r for r in picker("variables")}
    sembrados = {}
    fallidos = []

    for arbol in FAMILIA:
        print(f"\n{arbol['code']} — {arbol['name']}")
        destino = asegurar_artefacto(arbol, enums)
        if not destino:
            fallidos.append(arbol["code"])
            continue
        artifact_id, version_id, lock, estado = destino
        print(f"  artefacto {artifact_id} · versión {version_id} ({estado})")

        grafo = arbol["graph"]()
        cuerpo = {
            "dependencies": dependencias(arbol, variables),
            "intermediates": [],
            "outputContract": grafo["outputContract"],
            "conditions": grafo["conditions"],
            "actions": [],
            "nodes": grafo["nodes"],
            "edges": grafo["edges"],
        }
        guardado, lock = guardar_grafo(version_id, lock, cuerpo)
        if not guardado:
            fallidos.append(arbol["code"])
            continue
        print(f"  ✓ grafo guardado ({len(grafo['nodes'])} nodos, {len(grafo['edges'])} aristas)")

        for ref in arbol["references"]:
            vincular(version_id, ref, sembrados)

        if compilar(version_id, estado):
            sembrados[arbol["code"]] = {"artifactId": artifact_id, "versionId": version_id}
        else:
            # Sin compilar, quien lo referencie recibirá CHILD_VERSION_NOT_COMPILED.
            sembrados[arbol["code"]] = {"artifactId": artifact_id, "versionId": version_id}
            fallidos.append(f"{arbol['code']} (sin compilar)")

    centro = sembrados.get("RIESGO_CREDITICIO")
    print("\n" + "─" * 68)
    if centro:
        print("✅ Familia sembrada. El grafo de dependencias con AMBOS paneles llenos:")
        print(f"   /artifacts/{centro['artifactId']}/dependency-graph")
        print("   (2 dependencias · 2 dependientes)")
    if fallidos:
        print("\n⚠ Con problemas: " + ", ".join(fallidos))
        print("  Los mensajes del motor están arriba, tal cual los devolvió.")


if __name__ == "__main__":
    main()
