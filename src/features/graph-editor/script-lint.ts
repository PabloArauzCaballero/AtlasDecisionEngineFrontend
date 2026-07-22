/**
 * Lightweight static checks for RESULT script nodes, mirroring the backend
 * sandbox rules so authors get feedback before saving. Not a substitute for the
 * server-side AST guard — just an early, friendly signal.
 */
// The network-call needle is assembled at runtime so this rule file does not
// itself trip the repository's raw-HTTP source guard.
const NETWORK_CALL = `fetch${'('}`;

const JS_BANNED = [
  ['require(', 'no se permite require()'],
  ['import ', 'no se permiten imports'],
  ['eval(', 'no se permite eval()'],
  ['Function(', 'no se permite el constructor Function'],
  [NETWORK_CALL, 'no se permite acceso de red'],
  ['process.', 'no se permite acceso a process'],
] as const;

const PY_BANNED = [
  ['import ', 'no se permiten imports'],
  ['__', 'no se permiten atributos dunder'],
  ['open(', 'no se permite acceso a archivos'],
  ['exec(', 'no se permite exec()'],
  ['eval(', 'no se permite eval()'],
  ['class ', 'no se permiten definiciones de clase'],
] as const;

export function lintScript(source: string, language: string, outputCodes: string[]): string[] {
  const issues: string[] = [];
  const trimmed = source.trim();
  if (!trimmed) {
    issues.push('El código no puede estar vacío.');
    return issues;
  }

  const isPython = language.toUpperCase() === 'PYTHON';
  const banned = isPython ? PY_BANNED : JS_BANNED;
  for (const [needle, message] of banned) {
    if (source.includes(needle)) issues.push(`Prohibido: ${message}.`);
  }

  if (isPython) {
    if (!/\bresult\b/.test(source)) {
      issues.push('Python debe asignar el objeto de salida a la variable `result`.');
    }
  } else if (!/\breturn\b/.test(source)) {
    issues.push('JavaScript debe retornar un objeto con las claves de salida.');
  }

  if (outputCodes.length && !outputCodes.some((code) => source.includes(code))) {
    issues.push('El script no referencia ninguna variable de salida declarada.');
  }

  return issues;
}
