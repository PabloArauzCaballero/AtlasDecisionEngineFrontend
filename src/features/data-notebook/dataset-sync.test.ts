import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { fetchEngineDatasets } from './engine-datasets';
import { notebookCatalogResponseSchema } from './notebook.api';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const pedido = vi.mocked(apiRequest);

/**
 * Lo que fija esta batería es que el cuaderno no tenga NINGUNA lista de vistas propia.
 *
 * Las dos fuentes descubren su catálogo contra el catálogo de su base, así que una vista que
 * alguien publique mañana tiene que llegar hasta aquí sin tocar este repositorio. Una prueba
 * escrita con las vistas de hoy no diría nada de eso: éstas usan nombres que no existen en
 * ningún catálogo sembrado, y pasan justamente porque el portal no los conoce de antemano.
 */
beforeEach(() => pedido.mockReset());

/** Respuesta del catálogo del motor, con lo mínimo que el contrato exige. */
function catalogoMotor(overrides: Record<string, unknown> = {}) {
  return {
    datasets: [
      {
        name: 'riesgo',
        description: 'Bajo qué condiciones se deja operar.',
        tables: [
          {
            name: 'exposicion_por_producto',
            description: 'Exposición viva por producto.',
            grain: 'una exposición por producto y mes',
            columns: [{ name: 'producto', kind: 'texto', description: 'Producto.' }],
          },
        ],
      },
    ],
    limits: { maxRows: 10000, timeoutMs: 12000, maxStatementBytes: 65536 },
    ...overrides,
  };
}

describe('el cuaderno publica las vistas que el motor descubrió, sin conocerlas', () => {
  it('sirve una vista que este repositorio no menciona en ningún sitio', async () => {
    pedido.mockResolvedValueOnce(catalogoMotor());

    const { datasets } = await fetchEngineDatasets();

    expect(datasets).toHaveLength(1);
    expect(datasets[0].code).toBe('motor:riesgo.exposicion_por_producto');
    expect(datasets[0].view).toBe('riesgo.exposicion_por_producto');
  });

  it('arrastra el grano a la descripción, que es lo que evita contar mal', async () => {
    pedido.mockResolvedValueOnce(catalogoMotor());

    const { datasets } = await fetchEngineDatasets();

    expect(datasets[0].description).toContain('Una fila = una exposición por producto y mes.');
  });

  it('calla el grano en vez de escribir «Una fila = null» cuando el motor no lo declara', async () => {
    const catalogo = catalogoMotor();
    catalogo.datasets[0].tables[0].grain = null as unknown as string;
    pedido.mockResolvedValueOnce(catalogo);

    const { datasets } = await fetchEngineDatasets();

    expect(datasets[0].description).toBe('Exposición viva por producto.');
    expect(datasets[0].description).not.toContain('Una fila');
  });
});

describe('lo que un backend descartó llega hasta la pantalla', () => {
  it('conserva las relaciones omitidas del motor con su motivo', async () => {
    pedido.mockResolvedValueOnce(
      catalogoMotor({
        omitted: [{ name: 'riesgo.exposicion_global', reason: 'No acota por inquilino.' }],
      }),
    );

    const { omitted } = await fetchEngineDatasets();

    expect(omitted).toEqual([
      { name: 'riesgo.exposicion_global', reason: 'No acota por inquilino.' },
    ]);
  });

  /*
   * Contra el ESQUEMA y no contra `fetchNotebookCatalog`, y la diferencia no es de estilo.
   *
   * Quien valida es `apiRequest`, así que una prueba que lo mockee está comprobando su propio
   * mock: pasaría igual con el campo declarado que sin declarar, que es justo el fallo que se
   * quiere impedir. Ejercitando el esquema, la prueba se pone roja si alguien lo quita.
   */
  const LIMITES = {
    maxPageSize: 500,
    defaultPageSize: 100,
    maxDatasetRows: 20000,
    countCeiling: 200000,
    ratePerMinute: 60,
    maxResponseBytes: 8388608,
  };

  it('conserva las vistas omitidas de AtlasBackend, que Zod descartaba en silencio', () => {
    /*
     * Éste es el fallo concreto que la prueba existe para impedir que vuelva: AtlasBackend
     * llevaba mandando `omitted` desde que descubre su catálogo, y el esquema del portal no lo
     * declaraba. Zod descarta lo que no describe, así que el motivo por el que una vista no se
     * servía no llegaba a ninguna pantalla — y una vista mal publicada se leía exactamente igual
     * que una que nadie creó.
     */
    const catalogo = notebookCatalogResponseSchema.parse({
      data: {
        datasets: [],
        omitted: [{ view: 'v_pagos_v1', reason: 'No publica tenant_id.' }],
        limits: LIMITES,
        reveal: false,
      },
    });

    expect(catalogo.omitted).toEqual([{ view: 'v_pagos_v1', reason: 'No publica tenant_id.' }]);
  });

  it('acepta un backend anterior que todavía no manda las omitidas', () => {
    const catalogo = notebookCatalogResponseSchema.parse({
      data: { datasets: [], limits: LIMITES, reveal: false },
    });

    // Lista vacía, no una pantalla en blanco: el portal puede desplegarse antes que su API.
    expect(catalogo.omitted).toEqual([]);
  });
});
