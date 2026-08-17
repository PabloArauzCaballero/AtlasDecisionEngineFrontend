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
 * Recoge las figuras que la celda dejó abiertas y las devuelve como PNG en base64.
 *
 * Tres decisiones, y las tres tienen consecuencia:
 *
 * `sys.modules.get('matplotlib')` en vez de `import matplotlib`: se PREGUNTA si ya está importado
 * en lugar de importarlo. Importarlo aquí costaría un par de segundos en la primera celda de todo
 * el mundo —incluida la de quien sólo quería `df.head()`— y dejaría matplotlib cargado en sesiones
 * que no lo usan.
 *
 * `plt.close('all')` al terminar: sin cerrarlas, cada celda con `plt.plot(...)` acumula figuras y
 * la siguiente ejecución devolvería también las de antes. Se vería el gráfico anterior repetido
 * debajo del nuevo, que es peor que no verlo: parece un resultado.
 *
 * Y se serializa a JSON dentro de Python por la misma razón que el normalizador: nada de
 * `PyProxy` cruzando a JavaScript, que hay que liberar a mano y nadie se acuerda.
 */
/**
 * Inventario de nombres vivos: la memoria de variables que alimenta al editor.
 *
 * Corre DESPUÉS de cada celda y devuelve JSON, no objetos de Python, por lo mismo que el resto del
 * preámbulo: un `PyProxy` cruzando a JavaScript hay que liberarlo a mano y nadie se acuerda.
 *
 * Lo que se deja fuera es la mitad del trabajo. El espacio de nombres de Pyodide trae de fábrica los
 * dunders, los módulos que carga el intérprete y los ayudantes que este mismo preámbulo define
 * (`__atlas_*`, `_b64`, `_io`…). Sin filtrarlos, escribir dos letras ofrecería doscientos nombres
 * ajenos y los tres propios quedarían enterrados — un autocompletado que estorba más de lo que
 * ayuda es peor que ninguno.
 *
 * El TIPO se saca de `type(valor).__name__`, que es lo que distingue \`ventas\` DataFrame de
 * \`ventas\` entero, y es la información que ninguna lectura del código puede dar.
 *
 * El valor no viaja: aquí sólo van nombres y tipos. Una vista previa del contenido sacaría filas de
 * clientes del intérprete hacia el editor, que es exactamente lo que este módulo evita en todo lo
 * demás.
 */
export const INVENTARIO_SIMBOLOS = `
def __atlas_inventario():
    import json as _json
    import types as _types

    _fuera = {"rows", "columns", "df", "pd"}
    _salida = []
    for _nombre, _valor in list(globals().items()):
        if _nombre.startswith("_") or _nombre in _fuera:
            continue
        try:
            _tipo = type(_valor).__name__
        except Exception:
            continue
        if isinstance(_valor, _types.ModuleType):
            _origen = "modulo"
            _detalle = "módulo"
        elif callable(_valor):
            _origen = "funcion"
            _detalle = _tipo
        else:
            _origen = "variable"
            _detalle = _tipo
        _salida.append({"nombre": _nombre, "detalle": _detalle, "origen": _origen})
    return _json.dumps(_salida)

__atlas_inventario()
`;

export const CAPTURA_FIGURAS = `
def __atlas_figuras():
    import base64 as _b64
    import io as _io
    import json as _json
    import sys as _sys

    if _sys.modules.get("matplotlib") is None:
        return "[]"

    plt = _sys.modules.get("matplotlib.pyplot")
    if plt is None:
        return "[]"

    imagenes = []
    for numero in plt.get_fignums():
        figura = plt.figure(numero)
        buffer = _io.BytesIO()
        # 'tight' evita que se corten los rótulos de los ejes, que es como sale por omisión en
        # cuanto una etiqueta es un poco larga.
        figura.savefig(buffer, format="png", dpi=110, bbox_inches="tight")
        imagenes.append(_b64.b64encode(buffer.getvalue()).decode("ascii"))

    plt.close("all")
    return _json.dumps(imagenes)
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
