import { documentoDelSandbox, politicaDelSandbox, SCRIPT_INTERMEDIARIO } from './documento';
import {
  CANAL_SANDBOX,
  MAX_CARACTERES_MENSAJE,
  RESPUESTA_DEMASIADO_GRANDE,
  RESPUESTA_INVALIDA,
  leerCarga,
  leerMensajeDelSandbox,
} from './protocolo';
import { fuenteDelWorkerPython } from './python-worker';

function directivas(politica: string): Map<string, string> {
  return new Map(
    politica.split(';').map((entrada) => {
      const [nombre, ...valores] = entrada.trim().split(/\s+/u);
      return [nombre ?? '', valores.join(' ')];
    }),
  );
}

const base = { canal: CANAL_SANDBOX, v: 1 };

describe('marco aislado del cuaderno (MOT-03)', () => {
  describe('su CSP', () => {
    const politica = directivas(politicaDelSandbox('abc123', 'portal.atlas.test:3030'));

    it('es un documento sandbox, sin red salvo los ficheros de Pyodide', () => {
      expect(politica.get('sandbox')).toBe('allow-scripts');
      expect(politica.get('default-src')).toBe("'none'");
      expect(politica.get('connect-src')).toBe('portal.atlas.test:3030/pyodide/');
      expect(politica.get('worker-src')).toBe('blob:');
      expect(politica.get('frame-ancestors')).toBe("'self'");
    });

    it('sólo ejecuta el intermediario firmado y el intérprete, sin evaluar cadenas', () => {
      const script = politica.get('script-src') ?? '';
      expect(script).toContain("'nonce-abc123'");
      expect(script).toContain('portal.atlas.test:3030/pyodide/');
      expect(script).toContain("'wasm-unsafe-eval'");
      expect(script).not.toContain("'unsafe-eval'");
      expect(script).not.toContain("'self'");
    });

    it('un Host raro no se cuela en la política: sin host válido no hay red', () => {
      const rara = directivas(politicaDelSandbox('n', 'x; connect-src *'));
      expect(rara.get('connect-src')).toBe("'none'");
      expect(rara.get('script-src')).toBe("'nonce-n' 'wasm-unsafe-eval'");
      expect(directivas(politicaDelSandbox('n', null)).get('connect-src')).toBe("'none'");
    });
  });

  describe('su documento', () => {
    it('firma el intermediario con el nonce y no carga nada más', () => {
      const html = documentoDelSandbox('n0nce');
      expect(html).toContain('<script nonce="n0nce">');
      expect(html.match(/<script/gu)).toHaveLength(1);
    });

    it('el intermediario sólo escucha al portal y sólo le habla al portal', () => {
      expect(SCRIPT_INTERMEDIARIO).toContain(
        'evento.source !== parent || evento.origin !== PORTAL',
      );
      expect(SCRIPT_INTERMEDIARIO).toContain('parent.postMessage(mensaje, PORTAL)');
      expect(() => new Function(SCRIPT_INTERMEDIARIO)).not.toThrow();
    });

    it('el worker de Python es JavaScript válido y lleva el preámbulo dentro', () => {
      const fuente = fuenteDelWorkerPython();
      expect(() => new Function(fuente)).not.toThrow();
      expect(fuente).toContain('__atlas_normaliza');
      expect(fuente).toContain("importScripts(base + 'pyodide.js')");
    });
  });

  describe('lo que se acepta del marco', () => {
    it('descarta lo que no es del protocolo', () => {
      expect(leerMensajeDelSandbox(null)).toBeNull();
      expect(leerMensajeDelSandbox({ tipo: 'listo' })).toBeNull();
      expect(leerMensajeDelSandbox({ ...base, v: 2, tipo: 'listo' })).toBeNull();
      expect(leerMensajeDelSandbox({ ...base, tipo: 'otro', id: 'a' })).toBeNull();
      expect(
        leerMensajeDelSandbox({ ...base, tipo: 'progreso', id: 'a', detalle: 'x'.repeat(301) }),
      ).toBeNull();
      expect(leerMensajeDelSandbox({ ...base, tipo: 'listo' })).toEqual({ ...base, tipo: 'listo' });
    });

    it('un resultado demasiado grande se convierte en un error legible', () => {
      const enorme = 'x'.repeat(MAX_CARACTERES_MENSAJE + 1);
      const leido = leerMensajeDelSandbox({ ...base, tipo: 'resultado', id: 'a', carga: enorme });
      expect(leido).toMatchObject({ carga: { ok: false, error: RESPUESTA_DEMASIADO_GRANDE } });
    });

    it('lo que no se puede medir no se acepta', () => {
      const ciclo: Record<string, unknown> = {};
      ciclo.yo = ciclo;
      const leido = leerMensajeDelSandbox({ ...base, tipo: 'resultado', id: 'a', carga: ciclo });
      expect(leido).toMatchObject({ carga: { ok: false } });
    });

    it('una figura sólo puede ser base64: nada de URLs ni javascript:', () => {
      const salida = (images: string[]) => ({
        ok: true,
        salida: { status: 'ok', value: 1, images, logs: [], durationMs: 3 },
        simbolos: [],
      });
      expect(leerCarga('python-ejecutar', salida(['iVBORw0KGgo=']))).toMatchObject({ ok: true });
      expect(leerCarga('python-ejecutar', salida(['javascript:alert(1)']))).toEqual({
        ok: false,
        error: RESPUESTA_INVALIDA,
      });
    });

    it('cada operación tiene su forma y una carga ajena se rechaza', () => {
      expect(leerCarga('python-cargar', { ok: true, paquetes: ['pandas'] })).toEqual({
        ok: true,
        paquetes: ['pandas'],
      });
      expect(leerCarga('python-cargar', { ok: true })).toMatchObject({ ok: false });
      expect(leerCarga('javascript', { ok: false, plazo: true })).toEqual({
        ok: false,
        plazo: true,
      });
      expect(leerCarga('javascript', { ok: true, resultado: [{ a: 1 }] })).toMatchObject({
        ok: true,
      });
      expect(
        leerCarga('javascript', { ok: true, registro: Array(5_000).fill('linea') }),
      ).toMatchObject({ ok: false });
    });
  });
});
