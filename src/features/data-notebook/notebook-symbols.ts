import type { NotebookCell, NotebookLanguage } from './notebook-types';

/**
 * Qué nombres conoce el editor cuando escribes: la memoria de variables del cuaderno.
 *
 * ## De dónde salen los nombres
 *
 * De dos sitios, y hacen falta los dos:
 *
 * - **Leyendo el código** de las celdas anteriores. Está disponible SIEMPRE, incluso antes de
 *   ejecutar nada, que es justo cuando más se agradece: se escribe la celda de abajo mirando la de
 *   arriba, y todavía no ha corrido ninguna.
 * - **Preguntando al intérprete** después de ejecutar. Sólo entonces se sabe el TIPO —que `ventas`
 *   es un `DataFrame` y no un `int`— y aparecen los nombres que ninguna lectura estática puede
 *   deducir, como los que crea un `exec` o un desempaquetado raro.
 *
 * ## Por qué JavaScript no se trata como Python y R
 *
 * Ésta es la parte que no se puede copiar de otro cuaderno. En Python y en R el espacio de nombres
 * PERSISTE entre celdas: lo que definiste arriba sigue vivo abajo, y ofrecerlo es correcto. En este
 * cuaderno, cada celda de JavaScript corre en un **worker nuevo** (`js-runtime.ts` lo monta desde un
 * `blob:` para no necesitar `unsafe-eval`), así que las variables de otra celda NO existen cuando
 * ésta corre.
 *
 * Ofrecerlas igualmente sería el peor tipo de ayuda: el editor sugiere un nombre, se acepta, y la
 * celda falla con `ReferenceError` señalando a quien escribió —que hizo caso a la herramienta—. Por
 * eso en JavaScript sólo se ofrece lo de la celda misma y la API que el runtime sí inyecta.
 */

export type OrigenSimbolo = 'variable' | 'funcion' | 'modulo' | 'columna' | 'api';

export interface SimboloNotebook {
  readonly nombre: string;
  /** Lo que se enseña a la derecha del nombre: el tipo, o de dónde viene. */
  readonly detalle: string;
  readonly origen: OrigenSimbolo;
  readonly documentacion?: string;
}

/** Nombres que Python define solo y que sugerir sería ruido. */
const PYTHON_INTERNOS = /^(_{1,2}|atlas_)/u;

/** Los ayudantes que el propio cuaderno instala en el entorno global de R. */
const R_INTERNOS = /^\.atlas/u;

const PY_ASIGNACION = /^[ \t]*([A-Za-z_]\w*)[ \t]*(?::[^=\n]+)?=(?!=)/gmu;
const PY_MULTIPLE = /^[ \t]*([A-Za-z_]\w*(?:[ \t]*,[ \t]*[A-Za-z_]\w*)+)[ \t]*=(?!=)/gmu;
const PY_DEF = /^[ \t]*(?:async[ \t]+)?def[ \t]+([A-Za-z_]\w*)/gmu;
const PY_CLASE = /^[ \t]*class[ \t]+([A-Za-z_]\w*)/gmu;
const PY_IMPORT = /^[ \t]*import[ \t]+([A-Za-z_][\w.]*)(?:[ \t]+as[ \t]+([A-Za-z_]\w*))?/gmu;
const PY_FROM = /^[ \t]*from[ \t]+[\w.]+[ \t]+import[ \t]+(.+)$/gmu;
const PY_FOR = /^[ \t]*for[ \t]+([A-Za-z_]\w*(?:[ \t]*,[ \t]*[A-Za-z_]\w*)*)[ \t]+in[ \t]/gmu;
const PY_AS = /\bas[ \t]+([A-Za-z_]\w*)/gmu;

const JS_DECLARACION = /\b(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)/gmu;
const JS_FUNCION = /\bfunction[ \t]+([A-Za-z_$][\w$]*)/gmu;
const JS_CLASE = /\bclass[ \t]+([A-Za-z_$][\w$]*)/gmu;

/*
 * R declara con FLECHA, y con dos flechas distintas.
 *
 * `x <- 1` es lo normal, `x <<- 1` asigna al entorno de arriba, y `x = 1` también funciona en el
 * nivel superior. Buscar sólo el `=` —que es el reflejo al venir de Python— dejaría sin memoria de
 * variables a prácticamente todo el R que alguien escribe. La flecha a la DERECHA (`1 -> x`) existe
 * y no se busca: casi nadie la usa, y el patrón que la reconociera confundiría cualquier `->` de un
 * comentario con una declaración.
 */
const R_FLECHA = /^[ \t]*([A-Za-z._][\w.]*)[ \t]*<<?-(?!-)/gmu;
const R_IGUAL = /^[ \t]*([A-Za-z._][\w.]*)[ \t]*=(?![=>])/gmu;
const R_FUNCION = /^[ \t]*([A-Za-z._][\w.]*)[ \t]*<<?-[ \t]*(?:function|\\)[ \t]*\(/gmu;
const R_PAQUETE = /\b(?:library|require)\([ \t]*["']?([A-Za-z.][\w.]*)["']?[ \t]*\)/gmu;
const R_BUCLE = /^[ \t]*for[ \t]*\([ \t]*([A-Za-z._][\w.]*)[ \t]+in[ \t]/gmu;

function coincidencias(fuente: string, patron: RegExp, grupo = 1): string[] {
  // El patrón es global y `lastIndex` es estado: reutilizarlo entre llamadas sin reiniciarlo se
  // salta coincidencias según en qué punto quedó la anterior.
  patron.lastIndex = 0;
  const encontrados: string[] = [];
  let coincidencia: RegExpExecArray | null = patron.exec(fuente);
  while (coincidencia !== null) {
    const valor = coincidencia[grupo];
    if (valor !== undefined) encontrados.push(valor);
    coincidencia = patron.exec(fuente);
  }
  return encontrados;
}

function separarNombres(lista: string): string[] {
  return lista
    .split(',')
    .map(
      (parte) =>
        parte
          .trim()
          .split(/[ \t]+as[ \t]+/u)
          .pop() ?? '',
    )
    .map((parte) => parte.replace(/[()]/gu, '').trim())
    .filter((parte) => /^[A-Za-z_]\w*$/u.test(parte));
}

/** Los nombres que una fuente DEFINE, leyéndola sin ejecutarla. */
export function simbolosDeFuente(source: string, language: NotebookLanguage): SimboloNotebook[] {
  const encontrados = new Map<string, SimboloNotebook>();
  const anotar = (nombre: string, origen: OrigenSimbolo, detalle: string) => {
    if (!nombre || encontrados.has(nombre)) return;
    if (language === 'python' && PYTHON_INTERNOS.test(nombre)) return;
    if (language === 'r' && R_INTERNOS.test(nombre)) return;
    encontrados.set(nombre, { nombre, origen, detalle });
  };

  if (language === 'python') {
    for (const nombre of coincidencias(source, PY_DEF)) anotar(nombre, 'funcion', 'función');
    for (const nombre of coincidencias(source, PY_CLASE)) anotar(nombre, 'funcion', 'clase');
    for (const modulo of coincidencias(source, PY_IMPORT)) {
      // `import numpy.linalg` deja utilizable `numpy`, no `numpy.linalg`.
      anotar(modulo.split('.')[0] ?? modulo, 'modulo', 'módulo');
    }
    for (const alias of coincidencias(source, PY_IMPORT, 2)) anotar(alias, 'modulo', 'módulo');
    for (const lista of coincidencias(source, PY_FROM)) {
      for (const nombre of separarNombres(lista)) anotar(nombre, 'modulo', 'importado');
    }
    for (const lista of coincidencias(source, PY_MULTIPLE)) {
      for (const nombre of separarNombres(lista)) anotar(nombre, 'variable', 'variable');
    }
    for (const nombre of coincidencias(source, PY_ASIGNACION)) {
      anotar(nombre, 'variable', 'variable');
    }
    for (const lista of coincidencias(source, PY_FOR)) {
      for (const nombre of separarNombres(lista)) anotar(nombre, 'variable', 'variable de bucle');
    }
    for (const nombre of coincidencias(source, PY_AS)) anotar(nombre, 'variable', 'variable');
    return [...encontrados.values()];
  }

  if (language === 'r') {
    // La función va PRIMERO: gana quien anota antes, y `resumir <- function(x)` es a la vez una
    // asignación y una función. Sin este orden, el editor la ofrecería como «variable».
    for (const nombre of coincidencias(source, R_FUNCION)) anotar(nombre, 'funcion', 'function');
    for (const nombre of coincidencias(source, R_PAQUETE)) anotar(nombre, 'modulo', 'paquete');
    for (const nombre of coincidencias(source, R_FLECHA)) anotar(nombre, 'variable', 'variable');
    for (const nombre of coincidencias(source, R_IGUAL)) anotar(nombre, 'variable', 'variable');
    for (const nombre of coincidencias(source, R_BUCLE)) {
      anotar(nombre, 'variable', 'variable de bucle');
    }
    return [...encontrados.values()];
  }

  for (const nombre of coincidencias(source, JS_FUNCION)) anotar(nombre, 'funcion', 'función');
  for (const nombre of coincidencias(source, JS_CLASE)) anotar(nombre, 'funcion', 'clase');
  for (const nombre of coincidencias(source, JS_DECLARACION))
    anotar(nombre, 'variable', 'variable');
  return [...encontrados.values()];
}

/**
 * Lo que el runtime inyecta en toda celda. No sale de leer código: lo pone el cuaderno.
 *
 * Se declara aquí y no en cada runtime para que la sugerencia y la inyección no puedan separarse:
 * si mañana el preámbulo deja de definir `df`, esta lista es el sitio donde se ve.
 */
function apiDeCelda(language: NotebookLanguage): SimboloNotebook[] {
  if (language === 'r') {
    return [
      {
        nombre: 'df',
        origen: 'api',
        detalle: 'data.frame',
        documentacion: 'La página cargada del dataset, con una columna por columna servida.',
      },
      {
        nombre: 'columns',
        origen: 'api',
        detalle: 'character',
        documentacion: 'Nombres de las columnas, en el orden en que las sirve el dataset.',
      },
      {
        nombre: 'n',
        origen: 'api',
        detalle: 'integer',
        documentacion:
          'Filas cargadas: `nrow(df)`. Es la MUESTRA de esta página, no el total del dataset.',
      },
    ];
  }

  if (language === 'python') {
    return [
      {
        nombre: 'rows',
        origen: 'api',
        detalle: 'list[dict]',
        documentacion: 'La página cargada del dataset, tal como llegó.',
      },
      {
        nombre: 'columns',
        origen: 'api',
        detalle: 'list[str]',
        documentacion: 'Nombres de las columnas de la página cargada.',
      },
      {
        nombre: 'df',
        origen: 'api',
        detalle: 'DataFrame',
        documentacion: 'La misma página como DataFrame de pandas.',
      },
      {
        nombre: 'pd',
        origen: 'modulo',
        detalle: 'módulo',
        documentacion: 'pandas, ya importado por el preámbulo.',
      },
    ];
  }
  return [
    {
      nombre: 'rows',
      origen: 'api',
      detalle: 'Array<object>',
      documentacion: 'La página cargada del dataset.',
    },
    {
      nombre: 'columns',
      origen: 'api',
      detalle: 'string[]',
      documentacion: 'Nombres de las columnas de la página cargada.',
    },
  ];
}

/**
 * Todo lo que esta celda puede nombrar: su API, las columnas del dataset y la memoria de variables.
 *
 * `previas` son las celdas de código ANTERIORES a ésta, en orden. Para JavaScript llegan vacías por
 * la razón explicada arriba —cada celda corre en su propio worker— y eso no es una carencia: es la
 * verdad del entorno, dicha por el autocompletado.
 */
export function simbolosDisponibles(input: {
  readonly language: NotebookLanguage;
  readonly propia: string;
  readonly previas: readonly NotebookCell[];
  readonly columnas: readonly string[];
  readonly runtime: readonly SimboloNotebook[];
}): SimboloNotebook[] {
  const porNombre = new Map<string, SimboloNotebook>();
  const anotar = (simbolo: SimboloNotebook) => {
    // Gana el PRIMERO que se anota, y el orden de abajo pone el runtime delante: un tipo medido
    // vale más que uno adivinado leyendo el código.
    if (!porNombre.has(simbolo.nombre)) porNombre.set(simbolo.nombre, simbolo);
  };

  for (const simbolo of input.runtime) anotar(simbolo);
  for (const simbolo of apiDeCelda(input.language)) anotar(simbolo);
  for (const columna of input.columnas) {
    anotar({
      nombre: columna,
      origen: 'columna',
      detalle: 'columna',
      documentacion: 'Columna del dataset cargado.',
    });
  }
  /*
   * La herencia entre celdas es SÓLO de Python, y la regla se aplica aquí dentro.
   *
   * Estaba en quien llamaba —la consola pasaba una lista vacía para JavaScript— y eso la dejaba a
   * merced de que cada llamador la recordara: una pantalla nueva, o un descuido al refactorizar, y
   * el editor volvería a ofrecer variables que en un worker recién creado no existen. Una regla que
   * evita sugerir un `ReferenceError` no puede depender de la disciplina del que invoca.
   */
  if (input.language === 'python' || input.language === 'r') {
    for (const celda of input.previas) {
      if (celda.kind !== 'code' || celda.language !== input.language) continue;
      for (const simbolo of simbolosDeFuente(celda.source, input.language)) anotar(simbolo);
    }
  }
  for (const simbolo of simbolosDeFuente(input.propia, input.language)) anotar(simbolo);

  return [...porNombre.values()];
}
