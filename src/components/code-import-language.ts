import type { CodeImportIssue } from './CodeImportIssuesList';

export type ImportLanguage = 'JAVASCRIPT' | 'PYTHON';

export const LANGUAGE_LABELS: Readonly<Record<ImportLanguage, string>> = {
  JAVASCRIPT: 'JavaScript',
  PYTHON: 'Python',
};

/**
 * La cabecera del contrato se escribe con el comentario de cada lenguaje, así que
 * decide el idioma sin ambigüedad: el analizador la busca EXACTAMENTE con este
 * prefijo, y con el otro no la encuentra por mucho que esté ahí escrita.
 */
const MARKERS: Readonly<Record<ImportLanguage, RegExp>> = {
  PYTHON: /^[ \t]*#[ \t]*@atlas-contract[ \t]*$/m,
  JAVASCRIPT: /^[ \t]*\/\/[ \t]*@atlas-contract[ \t]*$/m,
};

/** Rasgos que sólo aparecen en uno de los dos lenguajes. Ninguno decide por sí solo. */
const SIGNALS: Readonly<Record<ImportLanguage, readonly RegExp[]>> = {
  PYTHON: [
    /^[ \t]*(?:if|elif|else|for|while)\b[^\n]*:[ \t]*$/m,
    /^[ \t]*def\s+[A-Za-z_]\w*\s*\(/m,
    /\bvariables\s*\.\s*get\s*\(/,
    /^[ \t]*result\s*=[^=]/m,
    /\b(?:True|False|None)\b/,
    /^[ \t]*#/m,
  ],
  JAVASCRIPT: [
    /^[ \t]*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/m,
    /^[ \t]*function\s+[A-Za-z_$][\w$]*\s*\(/m,
    /\}[ \t]*else\b/,
    /^[ \t]*return[ \t]*\{/m,
    /\bif\s*\([^\n]*\)[ \t]*\{/,
    /^[ \t]*\/\//m,
    /;[ \t]*$/m,
  ],
};

/** Diferencia mínima de rasgos para afirmar el lenguaje sin la cabecera. */
const MARGIN = 2;

/**
 * Lenguaje que aparenta tener el código pegado, o `null` si no está claro.
 *
 * Conservador a propósito: prefiere no opinar antes que mandar a alguien a
 * cambiar un selector que ya estaba bien.
 */
export function detectSourceLanguage(source: string): ImportLanguage | null {
  if (MARKERS.PYTHON.test(source)) return 'PYTHON';
  if (MARKERS.JAVASCRIPT.test(source)) return 'JAVASCRIPT';

  const score = (language: ImportLanguage) =>
    SIGNALS[language].filter((signal) => signal.test(source)).length;
  const python = score('PYTHON');
  const javascript = score('JAVASCRIPT');
  if (python - javascript >= MARGIN) return 'PYTHON';
  if (javascript - python >= MARGIN) return 'JAVASCRIPT';
  return null;
}

/** Línea de la cabecera del contrato, para señalar dónde se ve el desajuste. */
function markerLine(source: string, language: ImportLanguage): number {
  const prefix = language === 'PYTHON' ? '#' : '//';
  const index = source.split('\n').findIndex((line) => line.trim() === `${prefix} @atlas-contract`);
  return index === -1 ? 1 : index + 1;
}

/**
 * Revisión previa del selector de lenguaje.
 *
 * Sin esto, pegar un archivo Python con el selector en JavaScript (su valor
 * inicial) devolvía dos errores del motor que describen mal la causa: un
 * «Invalid or unexpected token» en la línea 1 y un «Missing "// @atlas-contract"
 * header» sobre un archivo que SÍ trae la cabecera, escrita con `#`. Ninguno de
 * los dos se arregla tocando el código.
 */
export function languageMismatchIssues(
  source: string,
  selected: ImportLanguage,
): CodeImportIssue[] {
  const detected = detectSourceLanguage(source);
  if (!detected || detected === selected) return [];
  return [
    {
      source: 'REVISIÓN PREVIA',
      severity: 'ERROR',
      line: markerLine(source, detected),
      code: 'CODE_IMPORT_LANGUAGE_MISMATCH',
      message: `El código pegado es ${LANGUAGE_LABELS[detected]} y el lenguaje seleccionado es ${LANGUAGE_LABELS[selected]}: el motor lo analizaría como ${LANGUAGE_LABELS[selected]} y rechazaría un archivo que está bien.`,
    },
  ];
}
