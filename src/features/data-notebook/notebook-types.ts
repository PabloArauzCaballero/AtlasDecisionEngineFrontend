/** Lo que una celda produce, en la forma en que la pantalla lo sabe dibujar. */

/**
 * Los tres lenguajes que una celda puede correr, y lo que tienen en común.
 *
 * Ninguno se ejecuta en un servidor: Python es CPython sobre WebAssembly (Pyodide), R es R sobre
 * WebAssembly (WebR) y JavaScript es un worker de la propia pestaña. **No hay un solo endpoint que
 * reciba código**, y por eso sumar un lenguaje no le añade al backend una superficie de ejecución
 * remota — que es el riesgo que suele traer una herramienta con esta forma.
 */
export type NotebookLanguage = 'python' | 'javascript' | 'r';

/** Los que llevan un intérprete que hay que descargar y arrancar. JavaScript ya está. */
export type NotebookInterpreter = 'python' | 'r';

/** Una tabla derivada: lo que devuelve un DataFrame o una lista de diccionarios. */
export interface DerivedTable {
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * Cuándo se calculó lo que se está viendo, si viene de un cuaderno guardado.
 *
 * `undefined` significa «se acaba de calcular en esta sesión». Cualquier otra cosa es un resultado
 * RESTAURADO, y la vista lo rotula con su fecha: los datos de debajo pueden haber cambiado desde
 * entonces, y un número viejo sin fecha junto a un dataset nuevo se lee como recién hecho.
 */
export type SavedAt = string | undefined;

export type CellOutcome =
  | {
      status: 'ok';
      savedAt?: SavedAt;
      /** El valor de la última expresión, ya normalizado. `undefined` si la celda no devolvió nada. */
      value: unknown;
      /** Tabla derivada, cuando el valor era un DataFrame, una Serie o una lista de registros. */
      table?: DerivedTable;
      /**
       * Figuras de matplotlib que dejó la celda, ya como PNG en `data:`.
       *
       * Van en el resultado y no en el registro porque un gráfico es un RESULTADO: se descarga, se
       * pega en un informe y se mira junto a la tabla que lo produjo. Tratarlo como una línea más
       * de salida lo habría dejado entre los `print`.
       */
      images?: string[];
      logs: string[];
      durationMs: number;
    }
  | {
      status: 'error';
      savedAt?: SavedAt;
      error: string;
      logs: string[];
      durationMs: number;
    };

/**
 * Qué es una celda: código que se ejecuta, o comentario que se lee.
 *
 * Se separa del lenguaje a propósito. Un comentario no es «Python que no corre»: no tiene número
 * de ejecución, no entra en el historial y no se le puede pedir que corra. Modelarlo como un
 * tercer valor de `language` habría metido un `if (language === 'markdown')` en el intérprete, en
 * el registro y en el atajo de teclado, y el que faltara se descubriría ejecutando un párrafo.
 */
export type NotebookCellKind = 'code' | 'markdown';

export interface NotebookCell {
  id: string;
  kind: NotebookCellKind;
  language: NotebookLanguage;
  source: string;
  outcome: CellOutcome | null;
  running: boolean;
  /** Número de ejecución, como en Colab: deja ver el ORDEN en que se corrió, no el orden en pantalla. */
  executionCount: number | null;
}

/**
 * Estado de un intérprete, que se descarga la primera vez que se usa.
 *
 * Es el mismo tipo para Python y para R a propósito: los dos son un artefacto de decenas de MB que
 * tarda en arrancar, y los dos tienen que poder decir en voz alta que están cargando y qué falta si
 * no arrancan. Dos tipos gemelos habrían garantizado que el segundo se quedara sin la mitad de los
 * avisos que el primero fue ganando.
 */
export type RuntimeStatus =
  | { phase: 'idle' }
  | { phase: 'loading'; detail: string }
  | { phase: 'ready'; packages: string[] }
  | { phase: 'unavailable'; reason: string };
