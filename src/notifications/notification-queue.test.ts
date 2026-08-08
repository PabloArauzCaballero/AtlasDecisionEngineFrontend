import { dedupeKeyFor, evictSurplus, findDuplicate } from './notification-queue';
import type { AppNotification, NotificationTone } from './notification.types';

let seq = 0;

function toast(tone: NotificationTone, overrides: Partial<AppNotification> = {}): AppNotification {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Aviso ${seq}`,
    tone,
    durationMs: tone === 'error' ? null : 4500,
    dedupeKey: `${tone} Aviso ${seq} `,
    createdAt: seq,
    lastOccurredAt: seq,
    repeatCount: 1,
    read: false,
    leaving: false,
    ...overrides,
  };
}

describe('huella de un aviso', () => {
  it('funde el mismo tono con los mismos textos', () => {
    const input = { title: 'Sin conexión', description: 'El motor no responde.' };
    expect(dedupeKeyFor(input, 'error')).toBe(dedupeKeyFor({ ...input }, 'error'));
  });

  it('separa el mismo texto en tonos distintos', () => {
    const input = { title: 'Versión enviada' };
    expect(dedupeKeyFor(input, 'success')).not.toBe(dedupeKeyFor(input, 'info'));
  });

  it('deja mandar a quien la escribe a mano', () => {
    const key = dedupeKeyFor({ title: 'Falló el nodo 4', dedupeKey: 'node-failure' }, 'error');
    expect(key).toBe('node-failure');
  });
});

describe('reconocer una repetición', () => {
  it('ignora el que ya se está marchando: refrescarlo lo dejaría a medias', () => {
    const leaving = toast('warning', { dedupeKey: 'k', leaving: true });
    expect(findDuplicate([leaving], 'k', 1000)).toBeUndefined();
  });

  it('un aviso con cuenta atrás caduca como repetición pasada la ventana', () => {
    const timed = toast('success', { dedupeKey: 'k', durationMs: 4500, lastOccurredAt: 0 });
    expect(findDuplicate([timed], 'k', 4000)).toBe(timed);
    expect(findDuplicate([timed], 'k', 9000)).toBeUndefined();
  });

  it('un fallo pegajoso sigue siendo el mismo suceso por mucho que espere', () => {
    // Lleva media hora en pantalla sin que nadie lo acuse: la segunda vez que
    // ocurre no merece una tarjeta nueva, merece que suba el contador.
    const sticky = toast('error', { dedupeKey: 'k', durationMs: null, lastOccurredAt: 0 });
    expect(findDuplicate([sticky], 'k', 1_800_000)).toBe(sticky);
  });
});

describe('recorte de la pila', () => {
  it('no toca nada mientras quepa', () => {
    const list = [toast('info'), toast('info')];
    expect(evictSurplus(list, 4)).toEqual({ kept: list, evicted: [] });
  });

  it('sacrifica lo menos grave antes que lo más antiguo', () => {
    // El fallo entra primero y es el más viejo de todos; aun así se queda.
    const failure = toast('error');
    const list = [failure, toast('success'), toast('success'), toast('info'), toast('success')];

    const { kept, evicted } = evictSurplus(list, 4);

    expect(evicted).toEqual([list[3]]);
    expect(kept).toContain(failure);
    // Los supervivientes conservan el orden en que se levantaron.
    expect(kept.map((entry) => entry.id)).toEqual(
      [list[0], list[1], list[2], list[4]].map((e) => e.id),
    );
  });

  it('entre iguales manda la antigüedad', () => {
    const list = [toast('error'), toast('error'), toast('error'), toast('error'), toast('error')];
    const { kept, evicted } = evictSurplus(list, 4);

    expect(evicted).toEqual([list[0]]);
    expect(kept).toHaveLength(4);
  });

  it('desempata por posición cuando varios nacen en el mismo milisegundo', () => {
    const born = { createdAt: 7 };
    const list = [
      toast('info', born),
      toast('info', born),
      toast('info', born),
      toast('info', born),
      toast('info', born),
    ];

    expect(evictSurplus(list, 4).evicted).toEqual([list[0]]);
  });
});
