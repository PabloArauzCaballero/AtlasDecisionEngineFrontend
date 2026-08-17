import type { NextRequest } from 'next/server';
import { middleware } from './middleware.next';

function request(pathname = '/data-notebook'): NextRequest {
  return {
    headers: new Headers({ cookie: 'session=abc' }),
    nextUrl: { pathname },
  } as unknown as NextRequest;
}

function directives(policy: string): Map<string, string> {
  return new Map(
    policy.split(';').map((entry) => {
      const [name, ...values] = entry.trim().split(/\s+/);
      return [name ?? '', values.join(' ')];
    }),
  );
}

describe('content security policy middleware', () => {
  it('emits a fresh nonce per request, in both the header and the forwarded request', () => {
    const first = middleware(request());
    const second = middleware(request());

    const nonceOf = (policy: string | null) => /'nonce-([a-f0-9]+)'/.exec(policy ?? '')?.[1];
    const firstNonce = nonceOf(first.headers.get('content-security-policy'));
    const secondNonce = nonceOf(second.headers.get('content-security-policy'));

    expect(firstNonce).toMatch(/^[a-f0-9]{32}$/);
    // Reutilizar el nonce entre respuestas lo volvería adivinable y la política
    // dejaría de valer para nada.
    expect(firstNonce).not.toBe(secondNonce);
  });

  it('locks down the directives that stop an injected script from doing damage', () => {
    const policy = middleware(request()).headers.get('content-security-policy') ?? '';
    const found = directives(policy);

    expect(found.get('default-src')).toBe("'self'");
    // Sin `object-src 'none'` un <object> inyectado sigue ejecutando.
    expect(found.get('object-src')).toBe("'none'");
    // Sin `base-uri` un <base> inyectado reescribe el destino de cada script.
    expect(found.get('base-uri')).toBe("'self'");
    // Sin `form-action` un formulario inyectado envía credenciales fuera.
    expect(found.get('form-action')).toBe("'self'");
    expect(found.get('frame-ancestors')).toBe("'none'");
    expect(found.get('connect-src')).toBe("'self'");
    expect(found.get('script-src')).toContain("'strict-dynamic'");
    // `'unsafe-eval'` sólo lo necesita el recargado en caliente del desarrollo.
    expect(found.get('script-src')).not.toContain("'unsafe-eval'");
  });

  /**
   * El artefacto de R lleva su PROPIA política, y la del portal no cambia.
   *
   * Un worker no hereda la CSP de la página que lo crea: la suya llega con su script. Estas dos
   * pruebas fijan las dos mitades del trato — el worker puede arrancar R, y la evaluación que
   * necesita para hacerlo NO se le concede al portal.
   */
  describe('el intérprete de R', () => {
    it('recibe una política de worker propia, sin red hacia fuera', () => {
      const policy = middleware(request('/webr/webr-worker.js')).headers.get(
        'content-security-policy',
      );
      const found = directives(policy ?? '');

      expect(found.get('default-src')).toBe("'none'");
      // Lo que impide que R descargue paquetes de terceros o saque filas del portal.
      expect(found.get('connect-src')).toBe("'self'");
      // Sin `'strict-dynamic'`: aquí `'self'` tiene que valer, o `importScripts` no carga R.
      expect(found.get('script-src')).not.toContain("'strict-dynamic'");
      expect(found.get('script-src')).toContain("'self'");
      expect(found.get('script-src')).toContain("'wasm-unsafe-eval'");
    });

    it('no contagia su permiso de evaluación al resto del portal', () => {
      const portal = middleware(request('/data-notebook')).headers.get('content-security-policy');
      expect(directives(portal ?? '').get('script-src')).not.toContain("'unsafe-eval'");
    });
  });
});
