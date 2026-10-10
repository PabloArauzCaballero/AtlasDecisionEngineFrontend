import { cerrarSandbox, pedirAlSandbox, RUTA_SANDBOX, RUTA_SANDBOX_R } from './cliente';
import { CANAL_SANDBOX } from './protocolo';

const base = { canal: CANAL_SANDBOX, v: 1 };

function marco(ruta = RUTA_SANDBOX): HTMLIFrameElement {
  const iframe = document.querySelector<HTMLIFrameElement>(`iframe[src="${ruta}"]`);
  if (!iframe) throw new Error('no hay marco');
  return iframe;
}

function desdeElMarco(datos: unknown, opciones: { origin?: string; source?: Window | null } = {}) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: datos,
      origin: opciones.origin ?? 'null',
      source: opciones.source === undefined ? marco().contentWindow : opciones.source,
    }),
  );
}

/** Captura lo que el portal manda al marco para poder contestar con el mismo id. */
function espiarEnvios() {
  const enviados: { id: string; op: string }[] = [];
  vi.spyOn(marco().contentWindow!, 'postMessage').mockImplementation((mensaje: unknown) => {
    enviados.push(mensaje as { id: string; op: string });
  });
  return enviados;
}

describe('cliente del marco aislado', () => {
  afterEach(() => {
    cerrarSandbox();
    vi.restoreAllMocks();
  });

  it('monta un iframe sandbox SIN allow-same-origin y espera a que diga «listo»', async () => {
    const pedido = pedirAlSandbox('javascript', { fuente: 'x', datos: {} });
    const iframe = marco();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.hidden).toBe(true);

    const enviados = espiarEnvios();
    desdeElMarco({ ...base, tipo: 'listo' });
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ ...base, op: 'javascript', fuente: 'x' });

    desdeElMarco({
      ...base,
      tipo: 'resultado',
      id: enviados[0].id,
      carga: { ok: true, resultado: 7 },
    });
    await expect(pedido).resolves.toEqual({ ok: true, resultado: 7 });
  });

  it('ignora mensajes de otra ventana o de un origen que no es el opaco', async () => {
    const pedido = pedirAlSandbox('python-cargar', { fuente: 'x' }, { plazoMs: 200 });
    const enviados = espiarEnvios();
    desdeElMarco({ ...base, tipo: 'listo' });
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    const id = enviados[0].id;
    const falso = { ...base, tipo: 'resultado', id, carga: { ok: true, paquetes: ['x'] } };

    desdeElMarco(falso, { origin: window.location.origin });
    desdeElMarco(falso, { source: window });
    await expect(pedido).resolves.toEqual({
      ok: false,
      error: 'La celda no respondió a tiempo y se descartó.',
    });
  });

  it('pasa el progreso y valida la carga contra su operación', async () => {
    const progreso = vi.fn();
    const pedido = pedirAlSandbox('python-cargar', { fuente: 'x' }, { progreso });
    const enviados = espiarEnvios();
    desdeElMarco({ ...base, tipo: 'listo' });
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    const id = enviados[0].id;

    desdeElMarco({ ...base, tipo: 'progreso', id, detalle: 'Cargando pandas…' });
    expect(progreso).toHaveBeenCalledWith('Cargando pandas…');
    desdeElMarco({ ...base, tipo: 'resultado', id, carga: { ok: true, paquetes: 'pandas' } });
    await expect(pedido).resolves.toMatchObject({ ok: false });
  });

  it('R va a SU marco, sin montar el general', async () => {
    const pedido = pedirAlSandbox('r-cargar', { orden: { accion: 'cargar' } }, { plazoMs: 300 });
    const r = marco(RUTA_SANDBOX_R);
    expect(r.getAttribute('sandbox')).toBe('allow-scripts');
    expect(document.querySelector(`iframe[src="${RUTA_SANDBOX}"]`)).toBeNull();

    const enviados: { id: string; op: string }[] = [];
    vi.spyOn(r.contentWindow!, 'postMessage').mockImplementation((mensaje: unknown) => {
      enviados.push(mensaje as { id: string; op: string });
    });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...base, tipo: 'listo' },
        origin: 'null',
        source: r.contentWindow,
      }),
    );
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ op: 'r' });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...base, tipo: 'resultado', id: enviados[0].id, carga: { ok: true } },
        origin: 'null',
        source: r.contentWindow,
      }),
    );
    await expect(pedido).resolves.toEqual({ ok: true });
  });
});
