import { categoriasACsv, COLUMNAS_CSV, leerCsv, leerJson, partirLinea } from './category-csv';
import { bloquean, revisarCategorias, type CategoriaSubida } from './category-upload-errors';
import type { SemanticCategory } from './categories.api';

/**
 * La subida masiva, y sobre todo QUÉ DICE cuando falla.
 *
 * Un archivo de doscientas filas lo escribió otra persona en una hoja de cálculo
 * hace dos días. Si el fallo no señala la fila y no dice cómo se arregla, el
 * único camino que queda es adivinar y reintentar, que es exactamente lo que
 * hace inservible una importación masiva.
 */

const CABECERA = COLUMNAS_CSV.join(',');

function revisarTexto(csv: string, existentes: string[] = []) {
  const lectura = leerCsv(csv);
  return [...lectura.problemas, ...revisarCategorias(lectura.categorias, new Set(existentes))];
}

describe('lectura de CSV', () => {
  it('lee una fila completa y separa los ejemplos por «|»', () => {
    const { categorias, problemas } = leerCsv(
      `${CABECERA}\n"GASTOS.MASCOTAS.VET","Veterinaria","Consultas, y tratamientos","GASTOS.MASCOTAS",0.62,"PAGO VETERINARIA|VETERINARIA","PAGO CONSULTA MEDICA"`,
    );
    expect(problemas).toEqual([]);
    expect(categorias[0]).toEqual({
      code: 'GASTOS.MASCOTAS.VET',
      name: 'Veterinaria',
      // La coma dentro de las comillas es texto, no un separador de campos.
      description: 'Consultas, y tratamientos',
      parentCode: 'GASTOS.MASCOTAS',
      acceptanceThreshold: 0.62,
      positiveExamples: ['PAGO VETERINARIA', 'VETERINARIA'],
      counterExamples: ['PAGO CONSULTA MEDICA'],
    });
  });

  it('una celda vacía en parentCode significa RAÍZ, no cadena vacía', () => {
    const { categorias } = leerCsv(`${CABECERA}\nGASTOS,Gastos,,,1,,`);
    expect(categorias[0].parentCode).toBeNull();
  });

  it('respeta las comillas dobles escapadas', () => {
    expect(partirLinea('"dijo ""hola""",b')).toEqual(['dijo "hola"', 'b']);
  });

  it('el ida y vuelta conserva el catálogo', () => {
    const catalogo: SemanticCategory[] = [
      {
        code: 'GASTOS.LUZ',
        name: 'Luz',
        parentCode: 'GASTOS',
        description: 'Energía, agua y gas',
        positiveExamples: ['PAGO LUZ', 'ENERGIA'],
        counterExamples: [],
        restrictions: [],
        relatedCategoryCodes: [],
        acceptanceThreshold: 0.62,
        version: 1,
        isActive: true,
      },
    ];
    const { categorias } = leerCsv(categoriasACsv(catalogo));
    expect(categorias[0].code).toBe('GASTOS.LUZ');
    expect(categorias[0].description).toBe('Energía, agua y gas');
    expect(categorias[0].positiveExamples).toEqual(['PAGO LUZ', 'ENERGIA']);
  });
});

describe('errores de subida: cada uno dice dónde, qué y cómo se arregla', () => {
  it('archivo vacío', () => {
    const [fallo] = leerCsv('').problemas;
    expect(fallo.codigo).toBe('ARCHIVO_VACIO');
    expect(fallo.arreglo).not.toBe('');
  });

  it('CSV sin la columna obligatoria, y dice cuál es la cabecera correcta', () => {
    const [fallo] = leerCsv('code,description\nGASTOS.X,algo').problemas;
    expect(fallo.codigo).toBe('CSV_COLUMNA_FALTA');
    expect(fallo.mensaje).toContain('name');
    expect(fallo.arreglo).toContain('code');
  });

  /*
   * El error más común de una hoja de cálculo: una coma dentro de un texto sin
   * entrecomillar. Sin señalar la línea, encontrarla en 200 filas es a mano.
   */
  it('CSV con una coma suelta: señala la línea y explica la causa', () => {
    const [fallo] = leerCsv(
      `${CABECERA}\nGASTOS.X,Nombre,Consultas, y tratamientos,,0.62,,`,
    ).problemas;
    expect(fallo.codigo).toBe('CSV_COLUMNAS_DESCUADRADAS');
    expect(fallo.donde).toBe('línea 2');
    expect(fallo.arreglo).toContain('comillas');
  });

  it('JSON inválido: no se manda al motor, se explica aquí', () => {
    const [fallo] = leerJson('[{"code": "X",}]').problemas;
    expect(fallo.codigo).toBe('JSON_INVALIDO');
  });

  it('JSON que no es un array', () => {
    const [fallo] = leerJson('{"code":"X"}').problemas;
    expect(fallo.codigo).toBe('JSON_NO_ES_ARRAY');
    expect(fallo.arreglo).toContain('[');
  });

  it('código con formato inválido', () => {
    const problemas = revisarTexto(`${CABECERA}\n"gastos mascotas",Mascotas,,,0.62,,`);
    expect(problemas.map((fallo) => fallo.codigo)).toContain('CODIGO_INVALIDO');
  });

  it('código repetido dentro del mismo archivo', () => {
    const problemas = revisarTexto(`${CABECERA}\nGASTOS.X,Uno,,,0.62,,\nGASTOS.X,Dos,,,0.62,,`);
    expect(problemas.map((fallo) => fallo.codigo)).toContain('CODIGO_DUPLICADO');
  });

  it('umbral fuera de rango', () => {
    const problemas = revisarTexto(`${CABECERA}\nGASTOS.X,Uno,,,7,,`);
    expect(problemas.map((fallo) => fallo.codigo)).toContain('UMBRAL_INVALIDO');
  });

  it('padre que no existe ni en el archivo ni en el catálogo', () => {
    const problemas = revisarTexto(`${CABECERA}\nGASTOS.X,Uno,,GASTOS.FANTASMA,0.62,,`);
    const fallo = problemas.find((otro) => otro.codigo === 'PADRE_INEXISTENTE');
    expect(fallo?.donde).toBe('GASTOS.X');
  });

  /*
   * El padre puede estar ya en el catálogo: es el caso normal al colgar una rama
   * nueva de un árbol existente, y reportarlo como error lo haría inservible.
   */
  it('un padre que ya está en el catálogo NO es un error', () => {
    const problemas = revisarTexto(`${CABECERA}\nGASTOS.X,Uno,,GASTOS,0.62,,`, ['GASTOS']);
    expect(problemas.map((fallo) => fallo.codigo)).not.toContain('PADRE_INEXISTENTE');
  });

  it('una categoría que se declara madre de sí misma', () => {
    const problemas = revisarTexto(`${CABECERA}\nGASTOS.X,Uno,,GASTOS.X,0.62,,`);
    expect(problemas.map((fallo) => fallo.codigo)).toContain('PADRE_CICLICO');
  });
});

describe('avisos sobre la forma del árbol', () => {
  const rama: CategoriaSubida = {
    code: 'GASTOS.CASA',
    name: 'Casa',
    description: '',
    parentCode: null,
    acceptanceThreshold: 0.62,
    positiveExamples: [],
    counterExamples: [],
  };
  const hoja: CategoriaSubida = { ...rama, code: 'GASTOS.CASA.LUZ', parentCode: 'GASTOS.CASA' };

  it('una rama alcanzable avisa, pero no impide subir', () => {
    const problemas = revisarCategorias([rama, hoja], new Set());
    const aviso = problemas.find((fallo) => fallo.codigo === 'RAMA_ALCANZABLE');
    expect(aviso?.severidad).toBe('aviso');
    expect(bloquean(problemas)).toBe(false);
  });

  it('una hoja con umbral 1 avisa de que no clasificará nada', () => {
    const problemas = revisarCategorias(
      [{ ...hoja, acceptanceThreshold: 1 }],
      new Set(['GASTOS.CASA']),
    );
    expect(problemas.map((fallo) => fallo.codigo)).toContain('HOJA_INALCANZABLE');
    expect(bloquean(problemas)).toBe(false);
  });
});
