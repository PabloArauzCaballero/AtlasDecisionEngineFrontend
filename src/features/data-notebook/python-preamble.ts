/**
 * El Python que el cuaderno ejecuta ANTES y DESPUÉS del código de cada celda.
 *
 * Vive en su propio archivo por una razón práctica: es Python dentro de TypeScript, y mezclarlo
 * con la lógica del cargador convierte cualquier cambio de una indentación en un fallo que sólo
 * aparece en el navegador.
 */

/**
 * Prepara el espacio de nombres de la sesión.
 *
 * Deja `rows` (lista de diccionarios) y, si pandas está disponible, `df` ya construido. Que `df`
 * exista sin escribir nada es lo que hace que esto se parezca a Colab y no a una consola: la
 * primera celda de cualquier análisis es siempre la misma, y escribirla a mano cada vez sólo
 * añade una forma de equivocarse.
 */
export const PREAMBULO_DATOS = `
import json as __atlas_json

rows = __atlas_json.loads(__atlas_rows_json)
columns = __atlas_json.loads(__atlas_columns_json)

try:
    import pandas as pd
    df = pd.DataFrame(rows, columns=columns if columns else None)
except ImportError:
    pd = None
    df = None
`;

/**
 * Convierte el valor de la última expresión en algo que la pantalla sabe dibujar.
 *
 * Se serializa a JSON DENTRO de Python y se devuelve una cadena, en vez de dejar que el objeto
 * cruce a JavaScript como `PyProxy`. Un proxy vivo hay que liberarlo a mano y, si se olvida, la
 * memoria del intérprete crece con cada celda ejecutada hasta que la pestaña se arrastra. Una
 * cadena no tiene ese problema.
 *
 * Un DataFrame se reconoce y viaja como tabla: es el 90 % de lo que devuelve una celda de
 * análisis, y enseñarlo como el `repr` de Python desperdiciaría la tabla que la pantalla ya sabe
 * pintar, ordenar y descargar.
 */
export const NORMALIZADOR = `
def __atlas_normaliza(valor):
    import json as _json
    import math as _math

    def _limpia(v):
        if isinstance(v, float) and (_math.isnan(v) or _math.isinf(v)):
            return None
        return v

    if valor is None:
        return _json.dumps({"kind": "none"})

    try:
        import pandas as _pd
    except ImportError:
        _pd = None

    if _pd is not None and isinstance(valor, _pd.DataFrame):
        marco = valor.where(_pd.notnull(valor), None)
        return _json.dumps({
            "kind": "table",
            "columns": [str(c) for c in marco.columns],
            "rows": _json.loads(marco.to_json(orient="records", date_format="iso")),
        })

    if _pd is not None and isinstance(valor, _pd.Series):
        serie = valor.where(_pd.notnull(valor), None)
        return _json.dumps({
            "kind": "table",
            "columns": [str(serie.index.name or "indice"), str(serie.name or "valor")],
            "rows": [{str(serie.index.name or "indice"): str(k), str(serie.name or "valor"): _limpia(v)}
                     for k, v in serie.items()],
        })

    if isinstance(valor, (list, tuple)) and valor and all(isinstance(f, dict) for f in valor):
        claves = []
        for fila in valor:
            for clave in fila:
                if clave not in claves:
                    claves.append(clave)
        return _json.dumps({"kind": "table", "columns": [str(c) for c in claves],
                            "rows": [{str(k): _limpia(f.get(k)) for k in claves} for f in valor]}, default=str)

    try:
        return _json.dumps({"kind": "value", "value": _limpia(valor)}, default=str)
    except (TypeError, ValueError):
        return _json.dumps({"kind": "value", "value": repr(valor)})
`;
