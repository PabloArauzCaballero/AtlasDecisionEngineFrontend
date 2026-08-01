import { describe, expect, it } from 'vitest';
import { coerce, detectDelimiter, parseSampleFile, type ImportField } from './sample-import';

const contract: ImportField[] = [
  { code: 'score', dataType: 'INTEGER', required: true },
  { code: 'amount', dataType: 'DECIMAL', required: true },
  { code: 'is_client', dataType: 'BOOLEAN', required: false },
  { code: 'tags', dataType: 'LIST', required: false },
];

describe('parseSampleFile', () => {
  it('lee un JSON con las variables sueltas', () => {
    const result = parseSampleFile('caso.json', '{"score": 720, "amount": 1500.5}', contract);
    expect(result.error).toBeUndefined();
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0].input).toEqual({ score: 720, amount: 1500.5 });
  });

  it('lee una lista JSON como varios casos', () => {
    const result = parseSampleFile('casos.json', '[{"score":700},{"score":800}]', contract);
    expect(result.cases.map((sample) => sample.input.score)).toEqual([700, 800]);
  });

  it('acepta la respuesta del propio generador, para recargar un lote guardado', () => {
    const generated = JSON.stringify({
      seed: 'abc',
      cases: [{ index: 0, kind: 'VALID', input: { score: 640, amount: 10 } }],
    });
    const result = parseSampleFile('generado.json', generated, contract);
    expect(result.cases[0].input).toEqual({ score: 640, amount: 10 });
  });

  it('convierte cada celda de CSV al tipo declarado', () => {
    const csv = 'score,amount,is_client,tags\n720,1500.50,true,"[1,2]"';
    const result = parseSampleFile('casos.csv', csv, contract);
    expect(result.cases[0].input).toEqual({
      score: 720,
      amount: 1500.5,
      is_client: true,
      tags: [1, 2],
    });
  });

  // Un CSV de Excel es-ES llega con `;` y coma decimal: sin esto, cada número quedaría
  // como texto y la simulación devolvería NO_DECISION culpando al motor.
  it('entiende el CSV con separador `;` y coma decimal', () => {
    const result = parseSampleFile('excel.csv', 'score;amount\n700;1234,75', contract);
    expect(result.cases[0].input).toEqual({ score: 700, amount: 1234.75 });
  });

  it('respeta las comas dentro de celdas entrecomilladas', () => {
    const csv = 'score,amount,tags\n700,10,"a,b"';
    const result = parseSampleFile('q.csv', csv, contract);
    expect(result.cases[0].input.tags).toBe('a,b');
    expect(result.cases[0].input.amount).toBe(10);
  });

  it('omite las celdas vacías en vez de mandar cadenas vacías', () => {
    const result = parseSampleFile('h.csv', 'score,amount,is_client\n700,10,', contract);
    expect(Object.keys(result.cases[0].input)).toEqual(['score', 'amount']);
  });

  it('avisa de columnas fuera del contrato y de obligatorias ausentes', () => {
    const result = parseSampleFile('x.csv', 'score,otro\n700,z', contract);
    expect(result.unknownKeys).toEqual(['otro']);
    expect(result.missingRequired).toEqual(['amount']);
    // Se cargan igual: el analista decide, el aviso no bloquea.
    expect(result.cases[0].input).toEqual({ score: 700, otro: 'z' });
  });

  it('un archivo ilegible devuelve un error, no un caso vacío', () => {
    expect(parseSampleFile('roto.json', '{no es json', contract).error).toBeTruthy();
    expect(parseSampleFile('vacio.csv', '   ', contract).error).toBeTruthy();
  });

  it('un CSV con sólo cabecera no inventa un caso en blanco', () => {
    const result = parseSampleFile('solo-cabecera.csv', 'score,amount\n', contract);
    expect(result.cases).toHaveLength(0);
    expect(result.error).toBeTruthy();
  });
});

describe('detectDelimiter', () => {
  it('elige el separador que más columnas produce, y coma por defecto', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a\tb')).toBe('\t');
    expect(detectDelimiter('unica_columna')).toBe(',');
  });
});

describe('coerce', () => {
  it('deja el texto original cuando la conversión no es posible', () => {
    expect(coerce('no-es-numero', 'INTEGER')).toBe('no-es-numero');
    expect(coerce('quizá', 'BOOLEAN')).toBe('quizá');
    expect(coerce('{roto', 'OBJECT')).toBe('{roto');
  });

  it('entiende sí/no además de true/false', () => {
    expect(coerce('sí', 'BOOLEAN')).toBe(true);
    expect(coerce('NO', 'BOOLEAN')).toBe(false);
  });
});
