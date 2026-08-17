/**
 * El R que el cuaderno ejecuta ANTES y DESPUÉS del código de cada celda.
 *
 * Vive en su propio archivo por lo mismo que `python-preamble.ts`: es R dentro de TypeScript, y
 * mezclarlo con la lógica del cargador convierte cualquier cambio de una llave en un fallo que sólo
 * aparece en el navegador.
 *
 * ## Por qué se serializa a JSON escrito a mano
 *
 * En R lo natural sería `jsonlite::toJSON`, y no está: WebR trae la base y los paquetes
 * recomendados, y todo lo demás se instala desde `repo.r-wasm.org` — un tercero con el que la CSP
 * del portal (`connect-src 'self'`) no deja hablar, y con razón. Escribir el serializador en R base
 * son treinta líneas y conserva la propiedad que importa: **el cuaderno no descarga nada de nadie.**
 *
 * ## Por qué todo devuelve una CADENA
 *
 * Igual que en Python: lo que cruza a JavaScript es texto, no un objeto vivo del intérprete. Un
 * objeto de R al otro lado hay que liberarlo a mano —WebR lo retiene en un `Shelter`— y lo que se
 * olvida se acumula celda tras celda hasta que la pestaña se arrastra.
 */

/**
 * Escritor de JSON en R base: escalares, vectores y objetos con clave.
 *
 * `.atlas_txt` se pelea con tres cosas que rompen un JSON y que ningún ejemplo enseña: la barra
 * invertida hay que escaparla ANTES que las comillas (al revés se escapa dos veces), los caracteres
 * de control cortan la cadena en el analizador del navegador, y `NA` no es `"NA"` — es ausencia, y
 * escribirlo como texto convierte un dato que falta en un dato que dice «NA».
 */
const JSON_R = `
.atlas_txt <- function(x) {
  s <- as.character(x)
  s <- gsub("\\\\", "\\\\\\\\", s, fixed = TRUE)
  s <- gsub("\\"", "\\\\\\"", s, fixed = TRUE)
  s <- gsub("\\n", "\\\\n", s, fixed = TRUE)
  s <- gsub("\\r", "\\\\r", s, fixed = TRUE)
  s <- gsub("\\t", "\\\\t", s, fixed = TRUE)
  s <- gsub("[[:cntrl:]]", " ", s)
  paste0("\\"", s, "\\"")
}

.atlas_escalar <- function(x) {
  if (length(x) == 0) return("null")
  if (is.list(x)) x <- x[[1]]
  if (length(x) != 1) return(.atlas_txt(paste(as.character(x), collapse = ", ")))
  if (is.na(x)) return("null")
  if (is.factor(x)) return(.atlas_txt(as.character(x)))
  if (is.logical(x)) return(if (isTRUE(x)) "true" else "false")
  if (is.numeric(x)) {
    if (!is.finite(x)) return("null")
    return(format(x, scientific = FALSE, trim = TRUE, digits = 15))
  }
  .atlas_txt(x)
}

.atlas_vector <- function(x) {
  if (length(x) == 0) return("[]")
  paste0("[", paste(vapply(seq_along(x), function(i) .atlas_escalar(x[i]), ""), collapse = ","), "]")
}

.atlas_objeto <- function(claves, valores) {
  if (length(claves) == 0) return("{}")
  pares <- vapply(seq_along(claves), function(i) paste0(.atlas_txt(claves[i]), ":", valores[i]), "")
  paste0("{", paste(pares, collapse = ","), "}")
}
`;

/**
 * El intérprete de una celda, y por qué el código de quien escribe NO se interpola.
 *
 * El código llega por una VARIABLE (`.atlas_codigo`, que el runtime enlaza como cadena) y se
 * analiza con `parse`. Pegarlo dentro de una plantilla de R sería la misma clase de error que
 * concatenar SQL: una comilla o una llave de más en la celda de alguien cambiarían la sentencia que
 * envuelve, no la suya. Aquí no hay plantilla que romper.
 *
 * Cada expresión se evalúa con `withVisible`, que es exactamente lo que hace la consola de R: `x <-
 * 1` devuelve 1 de forma INVISIBLE y no se enseña, mientras que `x` sí. Sin esto, una celda que sólo
 * guarda un subconjunto —`recientes <- subset(df, ...)`— volvería a pintar la tabla entera debajo,
 * que se lee como un resultado y no lo es.
 */
const EJECUTOR = `
.atlas_ejecuta <- function(codigo) {
  expresiones <- parse(text = codigo)
  ultimo <- list(value = NULL, visible = FALSE)
  for (expresion in expresiones) {
    ultimo <- withVisible(eval(expresion, envir = globalenv()))
  }
  ultimo
}

.atlas_visible <- function() {
  if (!exists(".atlas_ultimo", envir = globalenv())) return(NULL)
  if (isTRUE(.atlas_ultimo$visible)) .atlas_ultimo$value else NULL
}
`;

/** La sentencia que corre en cada celda. Constante: lo variable es `.atlas_codigo`. */
export const CORRER_CELDA = `.atlas_ultimo <- .atlas_ejecuta(.atlas_codigo)
invisible(NULL)`;

/** Lee el valor de la última expresión, ya normalizado a JSON. */
export const LEER_RESULTADO = `.atlas_normaliza(.atlas_visible())`;

/**
 * Deja el dataset cargado como `df`, `columns` y `n`.
 *
 * Los datos llegan por COLUMNAS y no por filas, y no es un detalle de implementación: R es
 * columnar, así que armar el `data.frame` desde columnas evita el `do.call(rbind, ...)` sobre miles
 * de listas —lento, y además adivinando el tipo fila a fila, de modo que una columna con un solo
 * valor de texto entre números sale entera de texto sin avisar—.
 *
 * `check.names = FALSE` conserva el nombre REAL de la columna. Sin él, R reescribe `total gasto`
 * como `total.gasto` y el código que alguien copió de la cabecera del panel deja de encontrarla.
 */
export const PREAMBULO_DATOS = `
df <- local({
  cols <- .atlas_columnas
  nombres <- names(cols)
  if (is.null(nombres) || length(nombres) == 0) {
    # Página sin filas: un marco vacío pero CON sus columnas. Uno sin columnas haría que \`columns\`
    # mintiera y que \`df$estado\` fallara con «objeto no encontrado» en vez de devolver cero filas,
    # que es la respuesta correcta a un dataset vacío.
    vacio <- rep(list(character(0)), length(.atlas_nombres))
    names(vacio) <- .atlas_nombres
    return(as.data.frame(vacio, check.names = FALSE, stringsAsFactors = FALSE))
  }
  marco <- as.data.frame(cols, check.names = FALSE, stringsAsFactors = FALSE, optional = TRUE)
  names(marco) <- nombres
  marco
})
columns <- .atlas_nombres
n <- nrow(df)
`;

/**
 * Convierte el valor de la última expresión en algo que la pantalla sabe dibujar.
 *
 * Un `data.frame` viaja como TABLA porque es el 90 % de lo que devuelve una celda de análisis, y
 * enseñarlo como el `print` de R desperdiciaría la tabla que la pantalla ya sabe pintar, ordenar y
 * descargar. Una matriz y un vector CON NOMBRES se tratan igual por el mismo motivo: en R son la
 * forma habitual de un resumen (`table()`, `colMeans()`), y verlos como texto plano obliga a leer lo
 * que se podía mirar.
 *
 * Lo que NO se convierte —un modelo, una función, una lista anidada— se enseña con su `print`, que
 * es lo que su autor escribió para que se lea. Inventarle una tabla lo haría parecer un dato
 * tabular que no es.
 */
export const NORMALIZADOR = `
.atlas_normaliza <- function(valor) {
  if (is.null(valor) || is.function(valor)) return('{"kind":"none"}')

  if (is.data.frame(valor)) {
    columnas <- names(valor)
    filas <- vapply(seq_len(nrow(valor)), function(i) {
      .atlas_objeto(columnas, vapply(columnas, function(c) .atlas_escalar(valor[[c]][i]), ""))
    }, "")
    return(paste0('{"kind":"table","columns":', .atlas_vector(columnas),
                  ',"rows":[', paste(filas, collapse = ","), "]}"))
  }

  if (is.matrix(valor) || is.table(valor)) {
    return(.atlas_normaliza(as.data.frame(valor, stringsAsFactors = FALSE)))
  }

  if (is.atomic(valor) && !is.null(names(valor)) && length(valor) > 0) {
    filas <- vapply(seq_along(valor), function(i) {
      .atlas_objeto(c("nombre", "valor"), c(.atlas_txt(names(valor)[i]), .atlas_escalar(valor[i])))
    }, "")
    return(paste0('{"kind":"table","columns":["nombre","valor"],"rows":[',
                  paste(filas, collapse = ","), "]}"))
  }

  if (is.atomic(valor) && length(valor) == 1) {
    return(paste0('{"kind":"value","value":', .atlas_escalar(valor), "}"))
  }

  if (is.atomic(valor)) {
    return(paste0('{"kind":"value","value":', .atlas_vector(valor), "}"))
  }

  texto <- paste(utils::capture.output(print(valor)), collapse = "\\n")
  paste0('{"kind":"value","value":', .atlas_txt(texto), "}")
}
`;

/**
 * Inventario de nombres vivos: la memoria de variables que alimenta al editor.
 *
 * Corre DESPUÉS de cada celda, y por eso puede decir el TIPO: leyendo `ventas <- cargar()` nadie
 * sabe si eso es un `data.frame` o un número, y es justo lo que hace útil la sugerencia.
 *
 * Se deja fuera lo que el cuaderno mismo define (`.atlas_*`) y lo que el preámbulo ya publica
 * (`df`, `columns`, `n`), que la lista de la API cubre con mejor descripción. Sin ese filtro, la
 * memoria de variables ofrecería los ayudantes internos del cuaderno como si fueran del análisis.
 *
 * El valor NO viaja: aquí sólo van nombres y tipos. Una vista previa sacaría filas de clientes del
 * intérprete hacia el editor, que es lo que este módulo evita en todo lo demás.
 */
export const INVENTARIO_SIMBOLOS = `
local({
  fuera <- c("df", "columns", "n")
  nombres <- ls(envir = globalenv(), all.names = FALSE)
  nombres <- nombres[!startsWith(nombres, ".atlas") & !(nombres %in% fuera)]
  if (length(nombres) == 0) return("[]")
  fichas <- vapply(nombres, function(nombre) {
    valor <- tryCatch(get(nombre, envir = globalenv()), error = function(e) NULL)
    tipo <- tryCatch(class(valor)[1], error = function(e) "desconocido")
    origen <- if (is.function(valor)) "funcion" else "variable"
    .atlas_objeto(c("nombre", "detalle", "origen"),
                  c(.atlas_txt(nombre), .atlas_txt(tipo), .atlas_txt(origen)))
  }, "")
  paste0("[", paste(fichas, collapse = ","), "]")
})
`;

/** Todo lo que se instala UNA vez, al arrancar el intérprete. */
export const ARRANQUE = [JSON_R, NORMALIZADOR, EJECUTOR].join('\n');
