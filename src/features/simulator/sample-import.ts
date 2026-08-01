/**
 * Lectura de un archivo de valores de prueba (JSON o CSV) contra el contrato de entrada
 * del artefacto.
 *
 * No es un `JSON.parse` con otro nombre. Un CSV exportado de Excel llega con cabeceras,
 * con `;` como separador en configuración regional española y con TODO en texto: un
 * `"720"` en una variable INTEGER haría que la simulación respondiera
 * NO_DECISION · VARIABLE_MISSING_OR_INVALID y el analista culparía al motor, no al
 * archivo. Por eso aquí se convierte cada celda al tipo declarado y se informa de lo que
 * no cuadra ANTES de simular.
 */
export interface ImportField {
  code: string;
  dataType: string;
  required: boolean;
}

export interface ImportedCase {
  label: string;
  input: Record<string, unknown>;
}

export interface ImportResult {
  cases: ImportedCase[];
  /** Columnas o claves que el artefacto no declara: se cargan igual, pero se avisan. */
  unknownKeys: string[];
  /** Obligatorias que el archivo no trae en ninguna fila. */
  missingRequired: string[];
  error?: string;
}

const NUMERIC = new Set(['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'FLOAT', 'CURRENCY', 'PERCENTAGE']);
const STRUCTURED = new Set(['OBJECT', 'JSON', 'ARRAY', 'LIST', 'STRUCTURED_RESULT']);
const TRUTHY = new Set(['true', '1', 'si', 'sí', 'yes', 'y', 'verdadero']);
const FALSY = new Set(['false', '0', 'no', 'n', 'falso']);

export function parseSampleFile(
  fileName: string,
  text: string,
  contract: ImportField[],
): ImportResult {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return empty('El archivo está vacío.');
  const isJson = /\.json$/i.test(fileName) || trimmed.startsWith('{') || trimmed.startsWith('[');
  try {
    const rows = isJson ? readJson(trimmed) : readCsv(trimmed);
    if (!rows.length) return empty('El archivo no contiene ninguna fila de valores.');
    return mapRows(rows, contract, isJson);
  } catch (error) {
    return empty(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
  }
}

function empty(error: string): ImportResult {
  return { cases: [], unknownKeys: [], missingRequired: [], error };
}

/**
 * Acepta las tres formas que se dan en la práctica: el objeto de variables suelto, una
 * lista de objetos, y la respuesta del propio generador (`{cases:[{input}]}`) para que un
 * lote generado y guardado se pueda volver a cargar tal cual.
 */
function readJson(text: string): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const nested = record.cases ?? record.variables ?? record.input;
    if (Array.isArray(nested)) return readJson(JSON.stringify(nested));
    if (nested && typeof nested === 'object') return [nested as Record<string, unknown>];
    return [record];
  });
}

/** Detecta el separador por la cabecera: `,`, `;` (Excel es-ES) o tabulador. */
export function detectDelimiter(header: string): string {
  const ranked = [',', ';', '\t']
    .map((candidate) => ({ candidate, columns: header.split(candidate).length }))
    .sort((a, b) => b.columns - a.columns)[0];
  return ranked.columns > 1 ? ranked.candidate : ',';
}

function readCsv(text: string): Record<string, unknown>[] {
  const delimiter = detectDelimiter(text.split(/\r?\n/)[0] ?? '');
  const table = splitCsv(text, delimiter);
  const [header, ...body] = table;
  if (!header?.length) throw new Error('El CSV no tiene una fila de cabecera con los códigos.');
  const codes = header.map((cell) => cell.trim());
  return body
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const record: Record<string, unknown> = {};
      codes.forEach((code, index) => {
        if (code) record[code] = row[index] ?? '';
      });
      return record;
    });
}

/**
 * Analizador de CSV con comillas: una celda entrecomillada puede contener el separador,
 * saltos de línea y comillas escapadas como `""`. Partir por comas rompería esas filas
 * silenciosamente, desplazando todas las columnas siguientes.
 */
function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell.replace(/\r$/, ''));
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function mapRows(
  rows: Record<string, unknown>[],
  contract: ImportField[],
  isJson: boolean,
): ImportResult {
  const byCode = new Map(contract.map((field) => [field.code, field]));
  const unknown = new Set<string>();
  const present = new Set<string>();
  const cases = rows.map((row, index) => {
    const input: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(row)) {
      const field = byCode.get(key);
      if (!field) unknown.add(key);
      // Una celda vacía se OMITE en vez de enviarse como "": para una variable opcional
      // eso es «no lo aporto» y deja que el motor aplique su valor por defecto, mientras
      // que una cadena vacía sería un valor inválido de tipo.
      if (!isJson && typeof raw === 'string' && raw.trim() === '') continue;
      present.add(key);
      input[key] = field ? coerce(raw, field.dataType) : raw;
    }
    return { label: `Caso ${index + 1}`, input };
  });
  return {
    cases,
    unknownKeys: [...unknown],
    missingRequired: contract
      .filter((field) => field.required && !present.has(field.code))
      .map((field) => field.code),
  };
}

/** Convierte una celda de texto al tipo declarado; si no se puede, la deja como vino. */
export function coerce(raw: unknown, dataType: string): unknown {
  if (typeof raw !== 'string') return raw;
  const value = raw.trim();
  const type = dataType.toUpperCase();
  if (NUMERIC.has(type)) {
    // Se admite la coma decimal, habitual en exportaciones es-ES.
    const numeric = Number(value.replace(/\s/g, '').replace(',', '.'));
    return value !== '' && Number.isFinite(numeric) ? numeric : raw;
  }
  if (type === 'BOOLEAN' || type === 'BOOL') {
    const lower = value.toLowerCase();
    if (TRUTHY.has(lower)) return true;
    if (FALSY.has(lower)) return false;
    return raw;
  }
  if (STRUCTURED.has(type)) {
    try {
      return JSON.parse(value);
    } catch {
      return raw;
    }
  }
  return raw;
}
