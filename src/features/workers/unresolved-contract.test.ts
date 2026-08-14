import {
  COLUMNAS_PENDIENTES,
  contratoDePendientes,
  leerAsignaciones,
  pendientesACsv,
  RespuestaInvalida,
  textoDePendiente,
} from './unresolved-contract';
import type { SemanticCategory } from './categories.api';
import type { UnresolvedItem } from './unresolved.api';

/**
 * El puente entre la bandeja y quien la resuelve fuera.
 *
 * Lo que sale tiene que bastar para decidir —glosas Y catálogo—, y lo que vuelve
 * tiene que validarse aquí: aplicar a ciegas un identificador que ya no existe o
 * un código inventado dejaría la bandeja peor de lo que estaba, y en bloque.
 */

function pendiente(parcial: Partial<UnresolvedItem> & { id: string }): UnresolvedItem {
  return {
    rawValue: 'DEBITO POS SUPERMERCADO | MCC 5411 | CONTABILIZADA | TX-1',
    normalizedValue: 'DEBITO POS SUPERMERCADO',
    source: 'semantic-analysis',
    context: null,
    suggestedCategoryCode: null,
    confidence: null,
    alternatives: null,
    occurrenceCount: 3,
    firstSeenAt: '2026-04-01',
    lastSeenAt: '2026-04-02',
    status: 'PENDING',
    ...parcial,
  };
}

function categoria(code: string, umbral = 0.62): SemanticCategory {
  return {
    code,
    name: code,
    parentCode: null,
    description: '',
    positiveExamples: [],
    counterExamples: [],
    restrictions: [],
    relatedCategoryCodes: [],
    acceptanceThreshold: umbral,
    version: 1,
    isActive: true,
  };
}

const catalogo = [
  categoria('GASTOS.ALIMENTACION.SUPERMERCADO'),
  categoria('GASTOS.SALUD.FARMACIA'),
  // Una rama no clasifica nada: umbral 1 y fuera del contrato.
  categoria('GASTOS', 1),
];
const validos = new Set(['GASTOS.ALIMENTACION.SUPERMERCADO', 'GASTOS.SALUD.FARMACIA']);

describe('contrato que se copia', () => {
  const lista = [pendiente({ id: '7' })];
  const contrato = contratoDePendientes(lista, catalogo);

  it('lleva las categorías disponibles: sin ellas se inventarían códigos', () => {
    expect(contrato).toContain('GASTOS.ALIMENTACION.SUPERMERCADO');
    expect(contrato).toContain('categoriasDisponibles');
  });

  it('no ofrece las ramas, que no clasifican nada', () => {
    // El bloque de datos, no el `{ "id": … }` del ejemplo de respuesta.
    const json = JSON.parse(contrato.slice(contrato.indexOf('{\n  "categoriasDisponibles"')));
    expect(json.categoriasDisponibles.map((fila: { code: string }) => fila.code)).toEqual([
      'GASTOS.ALIMENTACION.SUPERMERCADO',
      'GASTOS.SALUD.FARMACIA',
    ]);
  });

  it('dice qué se espera de vuelta, o lo que llegue no se podrá aplicar', () => {
    expect(contrato).toContain('"categoryCode"');
    expect(contrato).toContain('array JSON');
  });
});

describe('texto que se enseña de un pendiente', () => {
  it('prefiere el que el clasificador leyó, sin los identificadores', () => {
    const item = pendiente({
      id: '1',
      context: { textoClasificado: 'DEBITO POS SUPERMERCADO' },
    });
    expect(textoDePendiente(item)).toBe('DEBITO POS SUPERMERCADO');
  });

  it('si no hay texto limpio, enseña el original en vez de un hueco', () => {
    expect(textoDePendiente(pendiente({ id: '1' }))).toContain('MCC 5411');
  });
});

describe('respuesta que se pega de vuelta', () => {
  const lista = [pendiente({ id: '7' }), pendiente({ id: '8' })];

  it('acepta el array pelado', () => {
    const { asignaciones } = leerAsignaciones(
      '[{"id":"7","categoryCode":"GASTOS.SALUD.FARMACIA"}]',
      lista,
      validos,
    );
    expect(asignaciones).toEqual([{ id: '7', categoryCode: 'GASTOS.SALUD.FARMACIA' }]);
  });

  /* Media interfaz copia el JSON envuelto en un bloque de código. */
  it('tolera el bloque de código alrededor', () => {
    const { asignaciones } = leerAsignaciones(
      '```json\n[{"id":"8","categoryCode":"GASTOS.SALUD.FARMACIA"}]\n```',
      lista,
      validos,
    );
    expect(asignaciones).toHaveLength(1);
  });

  it('descarta lo que no existe aquí, y lo dice', () => {
    const { asignaciones, descartadas } = leerAsignaciones(
      JSON.stringify([
        { id: '7', categoryCode: 'GASTOS.SALUD.FARMACIA' },
        { id: '99', categoryCode: 'GASTOS.SALUD.FARMACIA' },
        { id: '8', categoryCode: 'GASTOS.INVENTADO' },
      ]),
      lista,
      validos,
    );
    expect(asignaciones).toHaveLength(1);
    expect(descartadas).toHaveLength(2);
    expect(descartadas.join(' ')).toContain('ya no está pendiente');
    expect(descartadas.join(' ')).toContain('no es una categoría del catálogo');
  });

  it('un texto que no es ni JSON ni CSV se rechaza con su motivo', () => {
    expect(() => leerAsignaciones('claro que sí', lista, validos)).toThrow(RespuestaInvalida);
  });
});

describe('la bandeja como CSV, para decidirla en una hoja', () => {
  const lista = [
    pendiente({ id: '7', suggestedCategoryCode: 'GASTOS.SALUD.FARMACIA', confidence: 0.41 }),
  ];

  it('lleva la cabecera que el lector espera de vuelta', () => {
    expect(pendientesACsv(lista).split('\r\n')[0]).toContain(COLUMNAS_PENDIENTES.join(','));
  });

  /*
   * Traerla rellena convertiría «subir el archivo tal cual» en aceptar de golpe
   * las conjeturas que no alcanzaron confianza: justo lo que la bandeja existe
   * para impedir.
   */
  it('deja «categoryCode» vacío aunque el motor tenga recomendación', () => {
    const fila = pendientesACsv(lista).split('\r\n')[1];
    expect(fila).toContain('GASTOS.SALUD.FARMACIA');
    expect(fila.endsWith(',')).toBe(true);
  });

  it('escapa la glosa: una que lleva coma partiría el archivo en dos columnas', () => {
    const conComa = [pendiente({ id: '7', rawValue: 'PAGO, CONSULTA' })];
    expect(pendientesACsv(conComa)).toContain('"PAGO, CONSULTA"');
  });
});

describe('archivo CSV que vuelve de la hoja de cálculo', () => {
  const lista = [pendiente({ id: '7' }), pendiente({ id: '8' })];
  const cabecera = COLUMNAS_PENDIENTES.join(',');

  it('lee las filas decididas', () => {
    const { asignaciones } = leerAsignaciones(
      `${cabecera}\r\n7,GLOSA,3,,,GASTOS.SALUD.FARMACIA\r\n`,
      lista,
      validos,
    );
    expect(asignaciones).toEqual([{ id: '7', categoryCode: 'GASTOS.SALUD.FARMACIA' }]);
  });

  /*
   * Una hoja reordena columnas sin avisar. Leyendo por posición, la glosa
   * acabaría de código de categoría.
   */
  it('encuentra las columnas por nombre, no por posición', () => {
    const { asignaciones } = leerAsignaciones(
      'categoryCode,texto,id\r\nGASTOS.SALUD.FARMACIA,GLOSA,8\r\n',
      lista,
      validos,
    );
    expect(asignaciones).toEqual([{ id: '8', categoryCode: 'GASTOS.SALUD.FARMACIA' }]);
  });

  it('la fila en blanco no es un fallo: sigue pendiente, y se dice una vez', () => {
    const { asignaciones, descartadas } = leerAsignaciones(
      `${cabecera}\r\n7,GLOSA,3,,,GASTOS.SALUD.FARMACIA\r\n8,OTRA,1,,,\r\n`,
      lista,
      validos,
    );
    expect(asignaciones).toHaveLength(1);
    expect(descartadas).toEqual(['1 fila(s) sin «categoryCode»: siguen pendientes.']);
  });

  it('valida contra el catálogo igual que el pegado', () => {
    const { asignaciones, descartadas } = leerAsignaciones(
      `${cabecera}\r\n7,GLOSA,3,,,GASTOS.INVENTADO\r\n`,
      lista,
      validos,
    );
    expect(asignaciones).toHaveLength(0);
    expect(descartadas.join(' ')).toContain('no es una categoría del catálogo');
  });

  /* El archivo que esta misma pantalla descarga tiene que volver admitido. */
  it('sobrevive a la marca de orden de bytes que escribe Excel', () => {
    const { asignaciones } = leerAsignaciones(
      `\uFEFF${cabecera}\r\n7,GLOSA,3,,,GASTOS.SALUD.FARMACIA\r\n`,
      lista,
      validos,
    );
    expect(asignaciones).toHaveLength(1);
  });
});
