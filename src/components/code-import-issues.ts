import type { CodeImportIssue } from './CodeImportIssuesList';

export interface IssueExplanation {
  /** Por qué ocurre, en términos del código que escribió la persona. */
  cause: string;
  /** Qué cambiar para que deje de ocurrir. */
  fix: string;
}

/**
 * Explicaciones accionables de los avisos del importador de código.
 *
 * El motor devuelve mensajes correctos pero cortos ("la clave de un resultado
 * debe ser un texto", "Python syntax error" en la línea 1), que no dicen qué hay
 * que cambiar. Estas explicaciones traducen cada aviso conocido a causa y
 * solución concretas, todas comprobadas contra el analizador real.
 *
 * Sólo se explica lo verificado: un aviso desconocido se muestra tal cual lo
 * envió el motor, porque inventar una causa sería peor que no dar ninguna.
 */
const BY_CODE: Record<string, IssueExplanation> = {
  CODE_IMPORT_TREE_NOT_DERIVABLE: {
    cause:
      'El analizador recorre el código buscando una cadena de condiciones que terminen en resultados. Cuando encuentra algo que no sabe traducir, deja de derivar el árbol y guarda todo el código como un único bloque: prefiere eso a traducir una regla a medias.',
    fix: 'Revisa la línea señalada. La causa más frecuente en Python es repartir el resultado en varias líneas; el analizador espera cada resultado en una sola línea.',
  },
  PYTHON_SYNTAX_ERROR: {
    cause:
      'El motor no pudo interpretar el código como Python. Además de los errores de sintaxis normales hay una causa que despista: una vocal acentuada en MAYÚSCULA en cualquier punto del archivo —incluido un comentario— provoca este mismo error señalando la línea 1.',
    fix: 'Comprueba la indentación y los paréntesis, y revisa que no haya vocales acentuadas en mayúscula en comentarios ni en textos del código.',
  },
  PYTHON_UPPERCASE_ACCENT: {
    cause:
      'El analizador de Python del motor no procesa Á, É, Í, Ó ni Ú, ni siquiera dentro de un comentario. Cuando aparece una, responde "Python syntax error" señalando la línea 1 aunque el código sea válido y el carácter esté mucho más abajo.',
    fix: 'Escribe esa palabra sin tilde o en minúsculas. Las minúsculas acentuadas (á, é, í, ó, ú) y la Ñ sí funcionan.',
  },
  CODE_IMPORT_CONTRACT_MISSING: {
    cause:
      'Sin la cabecera @atlas-contract no se puede saber qué datos necesita el algoritmo ni qué devuelve, así que tampoco se pueden crear sus variables de entrada y salida.',
    fix: 'Añade el bloque @atlas-contract en comentarios, con JSON válido, antes de la primera línea de código y sin comentarios entre medias.',
  },
  CODE_IMPORT_UNSAFE_CONSTRUCT: {
    cause:
      'El ejecutor corre el código en un entorno cerrado: no hay imports ni acceso a archivos, red o sistema. Se encontró una construcción fuera de ese entorno.',
    fix: 'Sustitúyela por operaciones sobre los datos que llegan en `variables`. Si necesitas un dato externo, decláralo como variable de entrada en el contrato.',
  },
};

/**
 * Cuando el motor no manda un código conocido se reconoce el aviso por su
 * mensaje: el analizador reutiliza las mismas frases para las mismas causas.
 */
const BY_MESSAGE: Array<{ match: RegExp; explanation: IssueExplanation }> = [
  {
    match: /clave de un resultado debe ser un texto/i,
    explanation: {
      cause:
        'El resultado está escrito de una forma que el analizador no puede leer clave por clave. En Python ocurre cuando el diccionario del resultado se reparte en varias líneas.',
      fix: 'Escribe cada resultado en una sola línea, con todas sus claves seguidas.',
    },
  },
];

export function explainImportIssue(issue: CodeImportIssue): IssueExplanation | null {
  const byMessage = BY_MESSAGE.find((entry) => entry.match.test(issue.message));
  if (byMessage) return byMessage.explanation;
  return BY_CODE[issue.code] ?? null;
}

/**
 * Vocales acentuadas en mayúscula: el analizador de Python del motor las
 * rechaza y culpa a la línea 1, que casi nunca es donde está el carácter.
 */
const UPPERCASE_ACCENT = /[ÁÉÍÓÚÜ]/;
const UPPERCASE_ACCENT_ALL = /[ÁÉÍÓÚÜ]/g;

/**
 * Revisión previa en el navegador, antes de mandar el código a analizar.
 *
 * Existe porque el error que devuelve el motor en este caso es inaccionable:
 * dice "syntax error" en la línea 1 aunque el Python sea válido y el carácter
 * esté cincuenta líneas más abajo. Aquí se señala la línea y el carácter exactos.
 *
 * Es una comprobación local y conservadora: no sustituye al análisis del motor,
 * sólo adelanta un fallo cuya causa está verificada.
 */
const ACCENT_REPLACEMENTS: Record<string, string> = {
  Á: 'A',
  É: 'E',
  Í: 'I',
  Ó: 'O',
  Ú: 'U',
  Ü: 'U',
};

/**
 * Quita las tildes de las mayúsculas conservando todo lo demás.
 *
 * Es la corrección que el usuario tendría que hacer a mano buscando carácter a
 * carácter. No toca minúsculas ni la Ñ, que el analizador acepta sin problema,
 * así que el texto sigue leyéndose en español correcto salvo esas mayúsculas.
 */
export function stripUppercaseAccents(source: string): string {
  return source.replace(UPPERCASE_ACCENT_ALL, (char) => ACCENT_REPLACEMENTS[char] ?? char);
}

export function localPythonIssues(source: string): CodeImportIssue[] {
  return source
    .split('\n')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter((row) => UPPERCASE_ACCENT.test(row.text))
    .map((row) => {
      const found = [...new Set(row.text.match(UPPERCASE_ACCENT_ALL) ?? [])];
      return {
        source: 'REVISIÓN PREVIA',
        severity: 'ERROR' as const,
        line: row.line,
        column: row.text.search(UPPERCASE_ACCENT) + 1,
        code: 'PYTHON_UPPERCASE_ACCENT',
        message: `El analizador de Python no admite vocales acentuadas en mayúscula (${found.join(' ')}) y rechazaría todo el archivo.`,
      };
    });
}
