import { NextResponse, type NextRequest } from 'next/server';

/**
 * Política de seguridad de contenido (CSP) con nonce por petición.
 *
 * El portal gobierna decisiones de crédito y muestra datos que vienen del
 * motor: si alguna vista dejara escapar HTML ajeno, la CSP es la única capa que
 * impide que ese HTML ejecute algo. Se emite desde aquí y no desde
 * `next.config.ts` porque el nonce tiene que cambiar en cada respuesta, y
 * Next.js lo lee de esta cabecera para firmar también sus propios scripts.
 *
 * `'strict-dynamic'` deja que los scripts que ya llevan nonce (los de Next)
 * carguen sus propios fragmentos sin tener que enumerarlos. En desarrollo se
 * añade `'unsafe-eval'`, que el recargado en caliente necesita y producción no.
 */
function contentSecurityPolicy(nonce: string): string {
  const devOnly = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devOnly}`,
    // Next.js inyecta estilos en línea al hidratar; no hay forma de firmarlos.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    /*
     * El audio del worker de locución llega como `blob:`, y sin esta línea NO
     * suena: `media-src` no estaba declarado, así que caía en `default-src
     * 'self'` y el navegador bloqueaba la reproducción. El fallo era silencioso
     * en la interfaz —el reproductor aparecía y no hacía nada—; sólo se veía en
     * la consola del navegador, que es donde nadie mira.
     *
     * `blob:` y no un origen: el portal no apunta el `<audio>` al motor, porque
     * cargar un medio es una navegación del navegador y ahí no viaja el
     * `Authorization`. Se pide con la credencial puesta y se reproduce local.
     */
    "media-src 'self' blob:",
    "font-src 'self' data:",
    // Todo el tráfico de datos es del mismo origen: el proxy `/v1` lo reenvía.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const policy = contentSecurityPolicy(nonce);

  // El nonce viaja en la petición para que el layout pueda firmar el script que
  // resuelve el tema antes del primer pintado.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', policy);
  return response;
}

export const config = {
  /**
   * Sólo documentos: los recursos estáticos y las imágenes optimizadas no
   * necesitan CSP y recalcular un nonce por cada uno sería puro coste.
   */
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
