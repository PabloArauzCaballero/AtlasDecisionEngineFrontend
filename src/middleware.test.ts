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

  it('deja pintar un PDF del expediente desde un blob local, y ningún marco de fuera', () => {
    const policy = middleware(request()).headers.get('content-security-policy') ?? '';
    // Sin `frame-src` el visor del PDF caía en `default-src` y quedaba en blanco, sin error.
    expect(directives(policy).get('frame-src')).toBe("'self' blob:");
  });

  describe('el intérprete de R (MOT-03)', () => {
    it('ya no recibe una política de worker propia: arranca en el marco aislado', () => {
      const policy = middleware(request('/webr/webr-worker.js')).headers.get(
        'content-security-policy',
      );
      const found = directives(policy ?? '');
      // Si alguien lo cargara como worker del mismo origen, la política del portal no le deja
      // importar el intérprete ni evaluar: falla cerrado, no con la cookie de sesión.
      expect(found.get('script-src')).toContain("'strict-dynamic'");
      expect(found.get('script-src')).not.toContain("'unsafe-eval'");
      expect(found.get('script-src')).not.toContain("'wasm-unsafe-eval'");
    });

    it('no contagia ningún permiso de evaluación al resto del portal', () => {
      const portal = middleware(request('/data-notebook')).headers.get('content-security-policy');
      expect(directives(portal ?? '').get('script-src')).not.toContain("'unsafe-eval'");
    });
  });

  describe('marco aislado del cuaderno (MOT-03)', () => {
    it('no le pone la CSP del portal: lleva la suya, y dos políticas se sumarían', () => {
      const respuesta = middleware(request('/notebook-sandbox'));
      expect(respuesta.headers.get('content-security-policy')).toBeNull();
    });

    it('la pestaña del portal ya no compila WebAssembly: Python vive en el marco', () => {
      const portal = middleware(request('/data-notebook')).headers.get('content-security-policy');
      expect(directives(portal ?? '').get('script-src')).not.toContain("'wasm-unsafe-eval'");
    });
  });
});
