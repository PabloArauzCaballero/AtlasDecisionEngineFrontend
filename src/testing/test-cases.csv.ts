import { parseJsonObject } from '../utils/json';

export interface CsvTestCasePayload {
  caseCode: string;
  testName: string;
  input: Record<string, unknown>;
  expectedResult: Record<string, unknown>;
  tags?: unknown;
  isActive: boolean;
}

function parseMatrix(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('El CSV contiene una comilla sin cerrar.');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseTestCasesCsv(csv: string): CsvTestCasePayload[] {
  const rows = parseMatrix(csv);
  if (rows.length < 2) throw new Error('El CSV debe incluir encabezados y al menos un caso.');

  const headers = rows[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim(),
  );
  const column = (name: string): number => {
    const index = headers.indexOf(name);
    if (index < 0) throw new Error(`Falta la columna obligatoria ${name}.`);
    return index;
  };
  const caseCode = column('caseCode');
  const testName = column('testName');
  const inputJson = column('inputJson');
  const expectedResultJson = column('expectedResultJson');
  const tagsJson = headers.indexOf('tagsJson');
  const isActive = headers.indexOf('isActive');

  if (rows.length - 1 > 500) throw new Error('Solo se permiten 500 casos por importación.');

  const parsed = rows.slice(1).map((values, index) => {
    const rowNumber = index + 2;
    try {
      const code = values[caseCode]?.trim().toUpperCase();
      const name = values[testName]?.trim();
      if (!code || !name) throw new Error('caseCode y testName son obligatorios');
      const rawTags = tagsJson >= 0 ? values[tagsJson]?.trim() : '';
      return {
        caseCode: code,
        testName: name,
        input: parseJsonObject(values[inputJson] ?? ''),
        expectedResult: parseJsonObject(values[expectedResultJson] ?? ''),
        tags: rawTags ? (JSON.parse(rawTags) as unknown) : undefined,
        isActive:
          isActive < 0 || !['false', '0', 'no'].includes(values[isActive]?.trim().toLowerCase()),
      };
    } catch (error) {
      throw new Error(
        `Fila ${rowNumber}: ${error instanceof Error ? error.message : 'contenido inválido'}.`,
      );
    }
  });

  const uniqueCodes = new Set(parsed.map((testCase) => testCase.caseCode));
  if (uniqueCodes.size !== parsed.length) throw new Error('El CSV contiene caseCode duplicados.');
  return parsed;
}
