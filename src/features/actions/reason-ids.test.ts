import { describe, expect, it, vi } from 'vitest';
import { resolverMotivos } from './reason-ids';

describe('resolverMotivos', () => {
  it('completa el id de un motivo nuevo a partir de su código', async () => {
    const buscar = vi.fn(async (codigo: string) => (codigo === 'FRAUDE_ALTO' ? '22' : null));
    const [accion] = await resolverMotivos(
      [{ code: 'a1', reasonCodes: [{ code: 'FRAUDE_ALTO', priority: 1 }] }],
      buscar,
    );
    expect(accion?.reasonCodes).toEqual([{ code: 'FRAUDE_ALTO', priority: 1, id: '22' }]);
  });

  it('conserva los motivos que ya traen id y no consulta por ellos', async () => {
    const buscar = vi.fn(async () => '99');
    const entrada = [{ code: 'a1', reasonCodes: [{ code: 'X', id: '5', priority: 2 }] }];
    const salida = await resolverMotivos(entrada, buscar);
    expect(salida).toEqual(entrada);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('consulta una sola vez un código repetido en varias acciones', async () => {
    const buscar = vi.fn(async () => '7');
    await resolverMotivos(
      [
        { code: 'a', reasonCodes: [{ code: 'M' }] },
        { code: 'b', reasonCodes: [{ code: 'M' }] },
      ],
      buscar,
    );
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('un motivo que no existe falla con un mensaje claro, sin enviar nada', async () => {
    await expect(
      resolverMotivos([{ code: 'a', reasonCodes: [{ code: 'NO_EXISTE' }] }], async () => null),
    ).rejects.toThrow(/«NO_EXISTE» no existe en el catálogo/);
  });

  it('un motivo sin prioridad recibe su orden (1, 2…) en vez de NaN', async () => {
    const [accion] = await resolverMotivos(
      [{ code: 'a', reasonCodes: [{ code: 'A' }, { code: 'B' }] }],
      async () => '3',
    );
    expect((accion?.reasonCodes as { priority: number }[]).map((m) => m.priority)).toEqual([1, 2]);
  });

  it('una acción sin motivos pasa igual', async () => {
    const entrada = [{ code: 'a', reasonCodes: [] }, { code: 'b' }];
    expect(await resolverMotivos(entrada, async () => '1')).toEqual(entrada);
  });
});
